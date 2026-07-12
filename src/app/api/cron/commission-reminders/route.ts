import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { BILLING_OWNER_EMAIL } from "@/lib/billing";
import { formatCents, formatDate } from "@/lib/sales-commissions";

// Sales-commission pay reminder. Runs daily: find approved (owed) commissions
// whose expected pay date has arrived and that haven't been reminded yet, email
// the owner a single "these are due to pay" digest, and stamp them so the same
// items aren't re-sent every day. The in-app "Due to pay now" banner is the
// live view; this is the nudge so nothing quietly sits unpaid.
export const maxDuration = 60;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app";

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

type DueRow = { id: string; rep_profile_id: string; label: string; amount_cents: number; payable_on: string | null };

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);

  // Owed, past their pay date, not yet reminded.
  const { data } = await admin
    .from("sales_commissions")
    .select("id, rep_profile_id, label, amount_cents, payable_on")
    .eq("status", "owed")
    .lte("payable_on", todayIso)
    .is("due_reminder_sent_at", null)
    .order("payable_on", { ascending: true });

  const due = (data ?? []) as DueRow[];
  if (due.length === 0) return NextResponse.json({ ok: true, reminded: 0 });

  // Resolve rep names for the digest.
  const repIds = [...new Set(due.map((d) => d.rep_profile_id))];
  const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", repIds);
  const repName = new Map(((profs ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || "(unnamed)"]));

  const total = due.reduce((t, r) => t + r.amount_cents, 0);
  const rowsHtml = due
    .map(
      (r) => `<tr>
        <td style="padding:6px 0;font-size:14px;color:#1a1a1a;">${esc(repName.get(r.rep_profile_id) ?? "?")}<span style="color:#888;"> · ${esc(r.label)}</span><span style="color:#aaa;font-size:12px;"> · due ${esc(formatDate(r.payable_on))}</span></td>
        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1a1a;text-align:right;">${formatCents(r.amount_cents)}</td>
      </tr>`
    )
    .join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:560px;">
    <p style="font-size:16px;font-weight:600;">Commissions due to pay 💸</p>
    <p style="font-size:14px;color:#525252;">${due.length} commission${due.length === 1 ? "" : "s"} ${due.length === 1 ? "has" : "have"} reached their pay date and are still owed — total <strong>${formatCents(total)}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee;margin:12px 0;">${rowsHtml}</table>
    <p style="font-size:14px;"><a href="${SITE}/admin/sales-commissions" style="color:#0a6cff;font-weight:600;">Open Sales Commissions</a> to review and mark them paid.</p>
  </div>`;

  let reminded = 0;
  try {
    await sendEmail({ to: [BILLING_OWNER_EMAIL], subject: `${formatCents(total)} in sales commissions due to pay`, html });
    await admin.from("sales_commissions").update({ due_reminder_sent_at: nowIso }).in("id", due.map((d) => d.id));
    reminded = due.length;
  } catch (e) {
    console.error("[commissions] due reminder failed", e);
  }

  return NextResponse.json({ ok: true, reminded });
}
