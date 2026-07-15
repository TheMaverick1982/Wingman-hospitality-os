import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isNotificationEnabled } from "@/lib/notifications";

// Continuing Education: on the 1st of each month, re-assign every active
// "rotates monthly" study-quiz test to staff as a FRESH attempt, so ongoing
// hospitality training is a monthly habit. Reuses test_assignments (and the
// existing test reminder/overdue crons handle the nudging + results).
export const maxDuration = 120;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}
function dueFrom(amount: number | null, unit: string | null, now: number): string {
  const days = amount && amount > 0 ? (unit === "weeks" ? amount * 7 : amount) : 14;
  return new Date(now + days * 86400000).toISOString();
}

type TestRow = { id: string; org_id: string; title: string; target_departments: string[] | null; complete_within_amount: number | null; complete_within_unit: string | null };

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const ym = new Date(now).toISOString().slice(0, 7); // YYYY-MM

  const { data: testRows } = await admin
    .from("tests")
    .select("id, org_id, title, target_departments, complete_within_amount, complete_within_unit")
    .eq("rotates_monthly", true)
    .eq("active", true)
    .eq("mode", "study_quiz");
  const tests = (testRows ?? []) as TestRow[];
  if (tests.length === 0) return NextResponse.json({ ok: true, assigned: 0 });

  // Group the monthly tests by org.
  const byOrg = new Map<string, TestRow[]>();
  for (const t of tests) {
    const list = byOrg.get(t.org_id) ?? [];
    list.push(t);
    byOrg.set(t.org_id, list);
  }

  let assigned = 0;
  for (const [orgId, orgTests] of byOrg) {
    const { data: orgRow } = await admin
      .from("organizations")
      .select("continuing_ed_month, notification_settings")
      .eq("id", orgId)
      .maybeSingle();
    const org = orgRow as { continuing_ed_month: string | null; notification_settings: Record<string, boolean> | null } | null;
    if (!org) continue;
    if (org.continuing_ed_month === ym) continue; // already ran this org this month
    if (!isNotificationEnabled(org.notification_settings, "monthly_training")) {
      // Respect the toggle, but still stamp the month so we don't retry hourly.
      await admin.from("organizations").update({ continuing_ed_month: ym }).eq("id", orgId);
      continue;
    }

    // Active staff for this org.
    const { data: staffRows } = await admin
      .from("staff_members")
      .select("id, full_name, email, department, location_id")
      .eq("org_id", orgId)
      .eq("status", "active");
    const staff = (staffRows ?? []) as { id: string; full_name: string; email: string; department: string; location_id: string | null }[];

    // Build fresh assignments: each test to staff whose role it targets (or all
    // if it targets none). A fresh attempt = progress columns reset.
    const rows: Record<string, unknown>[] = [];
    const perPerson = new Map<string, { name: string; email: string; titles: string[] }>();
    for (const t of orgTests) {
      const targets = (t.target_departments ?? []).filter(Boolean);
      const eligible = targets.length > 0 ? staff.filter((s) => targets.includes(s.department)) : staff;
      const due = dueFrom(t.complete_within_amount, t.complete_within_unit, now);
      for (const s of eligible) {
        rows.push({
          org_id: orgId, test_id: t.id, staff_id: s.id, location_id: s.location_id,
          assigned_at: new Date(now).toISOString(), due_at: due,
          status: "assigned", current_day: 1, attempts_used: 0, answers: {},
          best_score: null, last_score: null, passed_at: null, locked_at: null,
          locked_alerted: false, due_alerted: false, reminder_alerted: false,
          unlocked_by: null, unlocked_at: null, updated_at: new Date(now).toISOString(),
        });
        if (s.email) {
          const e = perPerson.get(s.id) ?? { name: s.full_name, email: s.email, titles: [] };
          e.titles.push(t.title);
          perPerson.set(s.id, e);
        }
      }
    }

    if (rows.length > 0) {
      const { error } = await admin.from("test_assignments").upsert(rows, { onConflict: "test_id,staff_id" });
      if (error) {
        console.error("continuing-ed upsert failed", orgId, error.message);
        continue;
      }
      assigned += rows.length;
    }

    // Email each assignee their monthly training (best-effort).
    for (const p of perPerson.values()) {
      const items = p.titles.map((t) => `<li style="margin:2px 0;">${esc(t)}</li>`).join("");
      const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="font-size:18px;color:#1a1a1a;">Your training for this month</h2>
        <p style="font-size:14px;color:#555;">${esc(p.name || "Hi")} — a quick refresher is ready. Great hospitality is a habit, so we keep it sharp every month.</p>
        <ul style="font-size:14px;color:#1a1a1a;padding-left:18px;">${items}</ul>
        <p style="margin-top:20px;"><a href="${SITE}/training/tests" style="background:#0a6cff;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Start this month's training</a></p>
      </div>`;
      try {
        await sendEmail({ to: [p.email], subject: "Your monthly training is ready", html });
      } catch (err) {
        console.error("continuing-ed email failed", err);
      }
    }

    await admin.from("organizations").update({ continuing_ed_month: ym }).eq("id", orgId);
  }

  return NextResponse.json({ ok: true, assigned });
}
