import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// Daily reminder to managers about interviews happening today. For each location
// with a confirmed interview today, email the location's address on file a short
// digest so nobody forgets a scheduled interview.
export const maxDuration = 60;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
const FALLBACK_ALERT = process.env.MONITOR_ALERT_EMAIL ?? "brian@brianhardy.com";

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

type Row = { id: string; name: string; department: string; location_id: string | null; interview_at: string; interview_details: string };

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);

  const { data } = await admin
    .from("job_applications")
    .select("id, name, department, location_id, interview_at, interview_details")
    .eq("status", "interviewing")
    .gte("interview_at", start.toISOString())
    .lt("interview_at", end.toISOString())
    .order("interview_at", { ascending: true });

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Group by location and resolve each location's email.
  const byLocation = new Map<string | null, Row[]>();
  for (const r of rows) {
    const list = byLocation.get(r.location_id) ?? [];
    list.push(r);
    byLocation.set(r.location_id, list);
  }

  let sent = 0;
  for (const [locationId, list] of byLocation) {
    let to = "";
    let locName = "";
    if (locationId) {
      const { data: loc } = await admin.from("locations").select("email, name").eq("id", locationId).maybeSingle();
      to = ((loc as { email?: string } | null)?.email || "").trim();
      locName = (loc as { name?: string } | null)?.name || "";
    }
    if (!to) to = FALLBACK_ALERT;

    const items = list
      .map((r) => {
        const t = new Date(r.interview_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        return `<tr>
          <td style="padding:6px 0;font-size:14px;color:#1a1a1a;"><strong>${t}</strong> · ${esc(r.name)}<span style="color:#888;">${r.department ? ` · ${esc(r.department)}` : ""}</span>${r.interview_details ? `<div style="color:#888;font-size:12.5px;">${esc(r.interview_details)}</div>` : ""}</td>
        </tr>`;
      })
      .join("");

    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:560px;">
      <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#0a6cff;margin:0 0 6px;">Interviews today${locName ? ` · ${esc(locName)}` : ""}</p>
      <p style="font-size:15px;color:#1a1a1a;margin:0 0 12px;">You have ${list.length} interview${list.length === 1 ? "" : "s"} scheduled today.</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee;margin:0 0 14px;">${items}</table>
      <p style="font-size:14px;"><a href="${SITE}/hiring" style="color:#0a6cff;font-weight:600;">Open Hiring</a> to see details and score them after.</p>
    </div>`;

    try {
      await sendEmail({ to: [to], subject: `${list.length} interview${list.length === 1 ? "" : "s"} today${locName ? ` — ${locName}` : ""}`, html });
      sent++;
    } catch (e) {
      console.error("[interview-reminders] send failed", e);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
