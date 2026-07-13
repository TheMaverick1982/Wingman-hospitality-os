import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

// How far ahead of the deadline we start nudging. Runs daily, so a 48h window
// means everyone with a future deadline gets one reminder roughly 1–2 days out.
const WINDOW_MS = 48 * 3600000;

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

function dueLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

// Runs daily. Finds test assignments that AREN'T finished yet (not passed, not
// locked) whose deadline is coming up within the window, and emails the trainee
// a friendly reminder to complete it in time — once per assignment. This is the
// employee-facing nudge; test-overdue is the manager-facing after-the-fact alert.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const cutoffIso = new Date(now + WINDOW_MS).toISOString();

  const { data: rows, error } = await admin
    .from("test_assignments")
    .select("id, due_at, status, current_day, staff_members(full_name, email), tests(id, title, day_count, mode)")
    .in("status", ["assigned", "in_progress"])
    .eq("reminder_alerted", false)
    .not("due_at", "is", null)
    .gt("due_at", nowIso) // still time to finish (overdue ones are handled elsewhere)
    .lte("due_at", cutoffIso)
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  const errors: string[] = [];

  for (const raw of rows ?? []) {
    const a = raw as unknown as {
      id: string; due_at: string; status: string; current_day: number;
      staff_members: { full_name: string; email: string } | null;
      tests: { id: string; title: string; day_count: number; mode: string } | null;
    };
    const email = (a.staff_members?.email || "").trim();
    if (!email || !email.includes("@") || !a.tests) continue; // no address, or test gone

    const firstName = (a.staff_members?.full_name || "there").split(" ")[0] || "there";
    const title = esc(a.tests.title);
    const link = `${SITE}/training/tests/${a.tests.id}/take`;
    const multiDay = a.tests.day_count > 1;
    const progress =
      a.status === "in_progress" && multiDay
        ? `<p>You're partway through — pick up on <strong>day ${Math.min(a.current_day, a.tests.day_count)} of ${a.tests.day_count}</strong>. You can work straight through the rest in one sitting if you like.</p>`
        : a.status === "in_progress"
          ? `<p>You started it but haven't finished — it only takes a few minutes to wrap up.</p>`
          : multiDay
            ? `<p>It's a ${a.tests.day_count}-day ${a.tests.mode === "study_quiz" ? "learn-then-quiz" : "test"}, and you can do the days back-to-back in one sitting.</p>`
            : "";

    try {
      await sendEmail({
        to: [email],
        subject: `Reminder: finish your ${a.tests.title} test`,
        html: `<p>Hi ${esc(firstName)},</p>
<p>This is a friendly reminder to complete your <strong>${title}</strong> test before it's due on <strong>${esc(dueLabel(a.due_at))}</strong>.</p>
${progress}
<p><a href="${link}" style="display:inline-block;background:#0a6cff;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600">Finish the test</a></p>
<p style="color:#666;font-size:13px">Your progress is saved as you go, so you can start now and come back if you need to.</p>`,
      });
      await admin.from("test_assignments").update({ reminder_alerted: true }).eq("id", a.id);
      sent++;
    } catch (e) {
      errors.push(`${a.id}: ${e instanceof Error ? e.message : "send failed"}`);
    }
  }

  return NextResponse.json({ ok: true, considered: rows?.length ?? 0, sent, errors });
}
