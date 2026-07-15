import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isNotificationEnabled } from "@/lib/notifications";

// Daily: email each manager the Partners follow-up tasks that have come due, then
// mark them notified so they're not re-sent. Day-granularity, so a single daily
// run is enough.
export const maxDuration = 60;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

type Row = {
  id: string;
  org_id: string;
  assigned_to: string | null;
  due_date: string;
  notes: string;
  location_id: string | null;
  partner_contacts: { company_name: string; contact_name: string; phone: string; email: string } | { company_name: string; contact_name: string; phone: string; email: string }[] | null;
};

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await admin
    .from("partner_follow_ups")
    .select("id, org_id, assigned_to, due_date, notes, location_id, partner_contacts(company_name, contact_name, phone, email)")
    .eq("done", false)
    .is("notified_at", null)
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Respect each org's "Follow-up task reminders" toggle. Rows for an org with
  // it off are dropped (and not marked notified, so re-enabling resumes them).
  const orgOn = new Map<string, boolean>();
  async function remindersOn(oid: string): Promise<boolean> {
    if (!orgOn.has(oid)) {
      const { data: o } = await admin.from("organizations").select("notification_settings").eq("id", oid).maybeSingle();
      orgOn.set(oid, isNotificationEnabled((o as { notification_settings?: Record<string, boolean> } | null)?.notification_settings ?? null, "partner_followups"));
    }
    return orgOn.get(oid)!;
  }

  // Group by assignee so each manager gets one digest (only for enabled orgs).
  const byAssignee = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.assigned_to) continue;
    if (!(await remindersOn(r.org_id))) continue;
    const list = byAssignee.get(r.assigned_to) ?? [];
    list.push(r);
    byAssignee.set(r.assigned_to, list);
  }

  let sent = 0;
  const notifiedIds: string[] = [];
  for (const [assignee, list] of byAssignee) {
    let to = "";
    try {
      const { data: u } = await admin.auth.admin.getUserById(assignee);
      to = u?.user?.email ?? "";
    } catch {
      to = "";
    }
    // Even if we can't resolve an email, mark them notified so we don't loop
    // forever on an orphaned assignee.
    list.forEach((r) => notifiedIds.push(r.id));
    if (!to) continue;

    const items = list
      .map((r) => {
        const c = Array.isArray(r.partner_contacts) ? r.partner_contacts[0] : r.partner_contacts;
        const contactLine = [c?.contact_name, c?.phone, c?.email].filter(Boolean).join(" · ");
        return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#1a1a1a;">
          <strong>${esc(c?.company_name ?? "A partner")}</strong>${contactLine ? `<div style="color:#888;font-size:12.5px;">${esc(contactLine)}</div>` : ""}
          ${r.notes ? `<div style="color:#555;font-size:13px;margin-top:2px;">${esc(r.notes)}</div>` : ""}
        </td></tr>`;
      })
      .join("");

    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="font-size:18px;color:#1a1a1a;">Your Partners follow-ups for today</h2>
      <p style="font-size:14px;color:#555;">${list.length} relationship${list.length === 1 ? "" : "s"} to circle back on:</p>
      <table style="width:100%;border-collapse:collapse;">${items}</table>
      <p style="margin-top:20px;"><a href="${SITE}/partners" style="background:#B3412C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Open Partners</a></p>
    </div>`;

    try {
      await sendEmail({ to: [to], subject: `Partners follow-ups: ${list.length} due today`, html });
      sent++;
    } catch (err) {
      console.error("partner-followups email failed", err);
    }
  }

  if (notifiedIds.length) {
    await admin.from("partner_follow_ups").update({ notified_at: new Date().toISOString() }).in("id", notifiedIds);
  }

  return NextResponse.json({ ok: true, sent, due: rows.length });
}
