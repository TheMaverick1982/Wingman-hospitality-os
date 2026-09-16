import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { getOrgOwnerEmails } from "@/lib/billing";
import { composeCultureRecap } from "@/lib/culture-recap";

export const maxDuration = 300;

// Runs daily; only acts on the 1st of the month. For each org that opted in
// (culture_recap_enabled), it AI-writes a recap of the month that just ended and
// emails it to the owner + managers. A per-org sent stamp prevents a double-send
// if the cron reruns. Org-wide (culture isn't per-location), so one email per org.
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

// Owner + manager emails for an org (culture recap is org-wide leadership news).
async function getLeadershipEmails(admin: ReturnType<typeof createAdminClient>, orgId: string): Promise<string[]> {
  const owners = await getOrgOwnerEmails(admin, orgId);
  const { data: mgrs } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", orgId)
    .in("access_role", ["gm", "manager"]);
  const emails = [...owners];
  for (const m of (mgrs ?? []) as { id: string }[]) {
    try {
      const { data } = await admin.auth.admin.getUserById(m.id);
      const email = data?.user?.email;
      if (email) emails.push(email);
    } catch {
      /* skip a member we can't resolve */
    }
  }
  return Array.from(new Set(emails.filter(Boolean)));
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (now.getUTCDate() !== 1) {
    return NextResponse.json({ ok: true, skipped: "not the 1st" });
  }

  const admin = createAdminClient();
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, name, culture_recap_enabled, culture_recap_sent_at, is_demo")
    .eq("culture_recap_enabled", true)
    .or("is_demo.is.null,is_demo.eq.false")
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of orgs ?? []) {
    const org = raw as { id: string; name: string; culture_recap_sent_at: string | null };
    // Don't re-send within 3 days (cron reruns / retries).
    if (org.culture_recap_sent_at && Date.now() - new Date(org.culture_recap_sent_at).getTime() < 3 * DAY_MS) { skipped++; continue; }

    const res = await composeCultureRecap(admin, { orgId: org.id, orgName: org.name, asOf: now });
    if (res.error || !res.summary) { skipped++; continue; } // no culture activity to recap

    const recipients = await getLeadershipEmails(admin, org.id);
    if (recipients.length === 0) { skipped++; continue; }

    const monthLabel = res.monthLabel ?? "Last month";
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;">
      <p style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#b45309;font-weight:600;margin:0 0 4px;">Monthly culture recap</p>
      <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 2px;">${esc(org.name)}</h1>
      <p style="font-size:12.5px;color:#888;margin:0 0 16px;">How your culture showed up in ${esc(monthLabel)} — recognition, the anonymous team pulse, and what you tried.</p>
      ${summaryToHtml(res.summary)}
      <p style="font-size:12px;color:#aaa;margin-top:20px;border-top:1px solid #eee;padding-top:12px;">You're getting this because the monthly culture recap is on for ${esc(org.name)}. Turn it off on the Culture page.</p>
    </div>`;

    try {
      await sendEmail({ to: recipients, subject: `Your ${monthLabel} culture recap — ${org.name}`, html });
      sent++;
      await admin.from("organizations").update({ culture_recap_sent_at: new Date().toISOString() }).eq("id", org.id);
    } catch (e) {
      errors.push(`${org.id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors: errors.slice(0, 20) });
}
