import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { getOrgOwnerEmails } from "@/lib/billing";
import { composeReviewSummary } from "@/lib/review-summary";

export const maxDuration = 300;

// Runs daily. Emails the combined guest-feedback readout (survey + Google
// reviews) to each location's email on file (cc the owner) on the cadence the
// owner picked — weekly (Mondays) or monthly (the 1st). Guarded so a location
// with no feedback yet, or no email, is simply skipped, and a per-org sent stamp
// prevents a double-send if the cron reruns.
const DAY_MS = 86400000;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// Turn the model's "**Header** — ..." + bullet lines into simple email HTML.
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
  const isFirst = now.getUTCDate() === 1;

  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, review_digest_frequency, review_digest_sent_at, is_demo")
    .in("review_digest_frequency", ["weekly", "monthly"])
    .or("is_demo.is.null,is_demo.eq.false")
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of orgs ?? []) {
    const org = raw as { id: string; name: string; review_digest_frequency: string; review_digest_sent_at: string | null };
    const due = org.review_digest_frequency === "weekly" ? isMonday : isFirst;
    if (!due) { skipped++; continue; }
    // Don't re-send within 3 days (cron reruns / retries).
    if (org.review_digest_sent_at && Date.now() - new Date(org.review_digest_sent_at).getTime() < 3 * DAY_MS) { skipped++; continue; }

    const period = org.review_digest_frequency === "weekly" ? "This week" : "This month";
    const ownerEmails = await getOrgOwnerEmails(admin, org.id);
    const { data: locs } = await admin.from("locations").select("id, name, email").eq("org_id", org.id);
    const locations = (locs ?? []) as { id: string; name: string; email: string | null }[];

    // Single-location orgs still have one location row; iterate all.
    let anySent = false;
    for (const loc of locations) {
      const to = (loc.email || "").trim();
      const recipients = Array.from(new Set([to, ...ownerEmails].filter(Boolean)));
      if (recipients.length === 0) continue;

      const res = await composeReviewSummary(admin, { orgId: org.id, orgName: org.name, scopeLocationId: loc.id });
      if (res.error || !res.summary) continue; // no feedback for this location yet

      const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;">
        <p style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#b45309;font-weight:600;margin:0 0 4px;">${esc(period)}'s guest feedback</p>
        <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 2px;">${esc(loc.name || org.name)}</h1>
        <p style="font-size:12.5px;color:#888;margin:0 0 16px;">A combined read across your guest survey${(res.googleCount ?? 0) > 0 ? " and Google reviews" : ""}.</p>
        ${summaryToHtml(res.summary)}
        <p style="font-size:12px;color:#aaa;margin-top:20px;border-top:1px solid #eee;padding-top:12px;">You're getting this because ${esc(period.toLowerCase())} guest-feedback reports are on for ${esc(org.name)}. Turn it off under Guests → Reviews.</p>
      </div>`;

      try {
        await sendEmail({
          to: recipients,
          subject: `${period}'s guest feedback — ${loc.name || org.name}`,
          html,
        });
        anySent = true;
        sent++;
      } catch (e) {
        errors.push(`${org.id}/${loc.id}: ${(e as Error).message}`);
      }
    }

    if (anySent) {
      await admin.from("organizations").update({ review_digest_sent_at: new Date().toISOString() }).eq("id", org.id);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors: errors.slice(0, 20) });
}
