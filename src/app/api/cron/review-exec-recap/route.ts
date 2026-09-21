import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { composeReviewSummary } from "@/lib/review-summary";

export const maxDuration = 300;

// Runs daily. Emails ownership a COMPANY-WIDE (all-locations) guest-feedback
// recap on the cadence the owner picked — daily (every day) or weekly (Mondays)
// — to the specific ownership addresses set on the Reviews page. Separate from
// the per-location review digest: one email per org, all locations combined,
// with supporting quotes and (optionally) the "This week" action. A per-org sent
// stamp prevents a double-send if the cron reruns.
const HOUR_MS = 3600000;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function summaryToHtml(summary: string): string {
  return summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const bold = esc(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (line.startsWith("**")) return `<p style="margin:14px 0 4px;font-size:14px;color:#1a1a1a;">${bold}</p>`;
      const bullet = line.replace(/^[-•]\s*/, "");
      if (bullet !== line) return `<li style="font-size:13.5px;color:#333;line-height:1.5;">${esc(bullet).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`;
      return `<p style="font-size:13.5px;color:#333;line-height:1.5;margin:4px 0;">${bold}</p>`;
    })
    .join("\n")
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g, (m) => `<ul style="margin:2px 0 8px;padding-left:20px;">${m}</ul>`);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const isMonday = now.getUTCDay() === 1;

  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, review_exec_frequency, review_exec_emails, review_exec_include_actions, review_exec_sent_at, is_demo")
    .in("review_exec_frequency", ["daily", "weekly"])
    .or("is_demo.is.null,is_demo.eq.false")
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of orgs ?? []) {
    const org = raw as { id: string; name: string; review_exec_frequency: string; review_exec_emails: string | null; review_exec_include_actions: boolean; review_exec_sent_at: string | null };
    const daily = org.review_exec_frequency === "daily";
    if (!daily && !isMonday) { skipped++; continue; }

    // Dedupe window: ~20h for daily (one per day), 3 days for weekly.
    const windowMs = daily ? 20 * HOUR_MS : 72 * HOUR_MS;
    if (org.review_exec_sent_at && Date.now() - new Date(org.review_exec_sent_at).getTime() < windowMs) { skipped++; continue; }

    const recipients = (org.review_exec_emails || "").split(/[,\n;]+/).map((s) => s.trim()).filter((s) => s.includes("@"));
    if (recipients.length === 0) { skipped++; continue; }

    // Company-wide: scopeLocationId null aggregates every location. Quotes on;
    // the "This week" action follows the owner's toggle. Only the trailing period
    // (daily = last day, weekly = last 7 days) so each recap covers NEW feedback
    // and never re-reports old reviews.
    const sinceIso = new Date(Date.now() - (daily ? 1 : 7) * 24 * HOUR_MS).toISOString();
    const res = await composeReviewSummary(admin, {
      orgId: org.id,
      orgName: org.name,
      scopeLocationId: null,
      includeActions: org.review_exec_include_actions !== false,
      includeQuotes: true,
      sinceIso,
      periodLabel: daily ? "the last day" : "the last week",
    });
    if (res.error || !res.summary) { skipped++; continue; } // no NEW feedback this period

    const period = daily ? "Today" : "This week";
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;">
      <p style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#b45309;font-weight:600;margin:0 0 4px;">${esc(period)}&rsquo;s ownership recap</p>
      <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 2px;">${esc(org.name)}</h1>
      <p style="font-size:12.5px;color:#888;margin:0 0 16px;">Company-wide guest feedback across all locations${(res.googleCount ?? 0) > 0 ? " — survey + Google reviews" : ""}.</p>
      ${summaryToHtml(res.summary)}
      <p style="font-size:12px;color:#aaa;margin-top:20px;border-top:1px solid #eee;padding-top:12px;">You&rsquo;re getting this because the ownership recap is on for ${esc(org.name)}. An owner can change the cadence or recipients under Guests → Reviews.</p>
    </div>`;

    try {
      await sendEmail({ to: recipients, subject: `${period}'s ownership recap — ${org.name}`, html });
      sent++;
      await admin.from("organizations").update({ review_exec_sent_at: new Date().toISOString() }).eq("id", org.id);
    } catch (e) {
      errors.push(`${org.id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors: errors.slice(0, 20) });
}
