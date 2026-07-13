"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";
import { sendEmail } from "@/lib/email";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { scoreTest, resolveAttempt } from "@/lib/tests";
import { isNotificationEnabled } from "@/lib/notifications";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
const FALLBACK_ALERT = process.env.MONITOR_ALERT_EMAIL ?? "brian@brianhardy.com";

async function manager() {
  const p = await getCurrentProfile();
  return p && canEditSection(p.accessRole, "training", p.permissionOverrides) ? p : null;
}

type StaffLite = { id: string; full_name: string; email: string; location_id: string };

function dueFrom(amount: number | null, unit: string): string | null {
  if (!amount) return null;
  const ms = unit === "hours" ? amount * 3600000 : amount * 86400000;
  return new Date(Date.now() + ms).toISOString();
}

async function emailAssignees(staff: StaffLite[], test: { id: string; title: string }): Promise<void> {
  const link = `${SITE}/training/tests/${test.id}/take`;
  await Promise.all(
    staff
      .filter((s) => s.email && s.email.includes("@"))
      .map((s) =>
        sendEmail({
          to: [s.email],
          subject: `You've been assigned a test: ${test.title}`,
          html: `<p>Hi ${s.full_name.split(" ")[0] || "there"},</p>
<p>You've been assigned the <strong>${test.title}</strong> test to complete.</p>
<p><a href="${link}" style="display:inline-block;background:#B4472E;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600">Take the test</a></p>
<p style="color:#666;font-size:13px">You can do it a day at a time or all at once. Sign in to Wingman and open Training → Tests to begin.</p>`,
        }).catch(() => undefined)
      )
  );
}

// Assign a test to specific staff members (idempotent — re-assigning refreshes
// the due date without wiping any progress) and email each of them a link.
export async function assignTest(testId: string, staffIds: string[]): Promise<{ error: string | null; assigned: number }> {
  const profile = await manager();
  if (!profile) return { error: "You don't have access to assign tests.", assigned: 0 };
  const ids = [...new Set(staffIds.filter(Boolean))];
  if (ids.length === 0) return { error: "Pick at least one person.", assigned: 0 };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found.", assigned: 0 };
  const { data: test } = await supabase.from("tests").select("id, title, complete_within_amount, complete_within_unit").eq("id", testId).maybeSingle();
  if (!test) return { error: "Test not found.", assigned: 0 };
  const { data: staff } = await supabase.from("staff_members").select("id, full_name, email, location_id").in("id", ids).eq("status", "active");
  const people = (staff ?? []) as StaffLite[];
  if (people.length === 0) return { error: "No active staff matched.", assigned: 0 };

  const dueAt = dueFrom(test.complete_within_amount, test.complete_within_unit);
  // Only supply the columns we want to (re)set — on conflict, progress columns
  // (status, current_day, answers, attempts_used) are left untouched.
  const rows = people.map((s) => ({ org_id: org.id, test_id: testId, staff_id: s.id, location_id: s.location_id, assigned_by: profile.userId, due_at: dueAt, reminder_alerted: false, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from("test_assignments").upsert(rows, { onConflict: "test_id,staff_id" });
  if (error) return { error: error.message, assigned: 0 };

  await emailAssignees(people, test);
  revalidatePath(`/training/tests/${testId}`);
  return { error: null, assigned: people.length };
}

// People-first assign: pick who (one person / a role / all staff) and hand them
// one or more tests in a single move. This is the primary "Start a test" flow;
// the per-test board still exists for reviewing results.
export type StartTarget =
  | { kind: "person"; staffId: string }
  | { kind: "role"; department: string }
  | { kind: "all" };

export async function startTests(
  target: StartTarget,
  testIds: string[],
  opts?: { locationId?: string | null; dueAt?: string | null }
): Promise<{ error: string | null; assigned: number; tests: number }> {
  const profile = await manager();
  if (!profile) return { error: "You don't have access to assign tests.", assigned: 0, tests: 0 };
  const ids = [...new Set(testIds.filter(Boolean))];
  if (ids.length === 0) return { error: "Pick at least one test.", assigned: 0, tests: 0 };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found.", assigned: 0, tests: 0 };

  const { data: testRows } = await supabase
    .from("tests")
    .select("id, title, target_departments, complete_within_amount, complete_within_unit")
    .in("id", ids);
  const tests = (testRows ?? []) as {
    id: string; title: string; target_departments: string[] | null; complete_within_amount: number | null; complete_within_unit: string;
  }[];
  if (tests.length === 0) return { error: "No tests found.", assigned: 0, tests: 0 };

  // Resolve the base pool of people from the target.
  let q = supabase.from("staff_members").select("id, full_name, email, department, location_id").eq("status", "active");
  if (target.kind === "person") q = q.eq("id", target.staffId);
  else if (target.kind === "role") q = q.eq("department", target.department);
  if (opts?.locationId) q = q.eq("location_id", opts.locationId);
  const { data: staffRows } = await q;
  const pool = (staffRows ?? []) as (StaffLite & { department: string })[];
  if (pool.length === 0) return { error: "No active staff matched.", assigned: 0, tests: 0 };

  // Build every (person × test) assignment. For "all staff", honor each test's
  // target roles so a bartender test doesn't land on the line cooks; an explicit
  // person/role pick is taken at face value.
  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  const perPerson = new Map<string, { name: string; email: string; titles: string[] }>();
  for (const t of tests) {
    const targets = (t.target_departments ?? []).filter(Boolean);
    const eligible = target.kind === "all" && targets.length > 0 ? pool.filter((s) => targets.includes(s.department)) : pool;
    const dueAt = opts?.dueAt ?? dueFrom(t.complete_within_amount, t.complete_within_unit);
    for (const s of eligible) {
      rows.push({ org_id: org.id, test_id: t.id, staff_id: s.id, location_id: s.location_id, assigned_by: profile.userId, due_at: dueAt, reminder_alerted: false, updated_at: now });
      const e = perPerson.get(s.id) ?? { name: s.full_name, email: s.email, titles: [] };
      e.titles.push(t.title);
      perPerson.set(s.id, e);
    }
  }
  if (rows.length === 0) return { error: "None of those tests apply to the people you picked.", assigned: 0, tests: 0 };

  // Only (re)set columns we own — progress columns stay put on conflict.
  const { error } = await supabase.from("test_assignments").upsert(rows, { onConflict: "test_id,staff_id" });
  if (error) return { error: error.message, assigned: 0, tests: 0 };

  // One combined email per person listing everything they were handed.
  await Promise.all(
    [...perPerson.values()]
      .filter((p) => p.email && p.email.includes("@"))
      .map((p) =>
        sendEmail({
          to: [p.email],
          subject: p.titles.length === 1 ? `You've been assigned a test: ${p.titles[0]}` : `You've been assigned ${p.titles.length} tests`,
          html: `<p>Hi ${p.name.split(" ")[0] || "there"},</p>
<p>You've been assigned ${p.titles.length === 1 ? "a test" : `${p.titles.length} tests`} to complete:</p>
<ul style="margin:0 0 14px;padding-left:20px">${p.titles.map((t) => `<li style="margin:2px 0">${t}</li>`).join("")}</ul>
<p><a href="${SITE}/training/tests" style="display:inline-block;background:#0a6cff;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600">Open my tests</a></p>
<p style="color:#666;font-size:13px">Sign in to Wingman and open Training → Tests to begin. You can do each a day at a time, or all at once.</p>`,
        }).catch(() => undefined)
      )
  );

  revalidatePath("/training");
  revalidatePath("/training/tests");
  return { error: null, assigned: perPerson.size, tests: tests.length };
}

export async function assignTestToRole(testId: string, department: string): Promise<{ error: string | null; assigned: number }> {
  if (!(await manager())) return { error: "Not authorized.", assigned: 0 };
  if (!ALL_DEPARTMENTS.includes(department as Department)) return { error: "Pick a role.", assigned: 0 };
  const supabase = await createClient();
  const { data: staff } = await supabase.from("staff_members").select("id").eq("department", department).eq("status", "active");
  return assignTest(testId, (staff ?? []).map((s) => (s as { id: string }).id));
}

// Send to all active staff (respecting the test's role targeting if it has any).
export async function assignTestToAll(testId: string): Promise<{ error: string | null; assigned: number }> {
  if (!(await manager())) return { error: "Not authorized.", assigned: 0 };
  const supabase = await createClient();
  const { data: test } = await supabase.from("tests").select("target_departments").eq("id", testId).maybeSingle();
  let q = supabase.from("staff_members").select("id, department").eq("status", "active");
  const targets = ((test?.target_departments ?? []) as string[]).filter(Boolean);
  if (targets.length > 0) q = q.in("department", targets);
  const { data: staff } = await q;
  return assignTest(testId, (staff ?? []).map((s) => (s as { id: string }).id));
}

// Manager clears a lock and grants one more attempt (after coaching).
export async function unlockAssignment(assignmentId: string, testId: string): Promise<{ error: string | null }> {
  const profile = await manager();
  if (!profile) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("test_assignments")
    .update({ status: "assigned", current_day: 1, answers: {}, locked_at: null, locked_alerted: false, reminder_alerted: false, unlocked_by: profile.userId, unlocked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) return { error: error.message };
  revalidatePath(`/training/tests/${testId}`);
  return { error: null };
}

export async function unassign(assignmentId: string, testId: string): Promise<void> {
  if (!(await manager())) return;
  const supabase = await createClient();
  await supabase.from("test_assignments").delete().eq("id", assignmentId);
  revalidatePath(`/training/tests/${testId}`);
}

// ---- Taking the test (staff) — guarded in code, run via the admin client ----

export type SubmitResult = { error: string | null; done?: boolean; nextDay?: number; passed?: boolean; locked?: boolean; score?: number };

export async function submitDay(assignmentId: string, dayNumber: number, answers: Record<string, number>): Promise<SubmitResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You're not signed in." };
  const admin = createAdminClient();

  const { data: staff } = await admin.from("staff_members").select("id, full_name, location_id").eq("profile_id", profile.userId).eq("org_id", profile.orgId).maybeSingle();
  if (!staff) return { error: "Your login isn't linked to a staff record yet — ask a manager." };
  const staffRow = staff as { id: string; full_name: string; location_id: string | null };

  const { data: aRow } = await admin.from("test_assignments").select("*").eq("id", assignmentId).eq("staff_id", staffRow.id).maybeSingle();
  if (!aRow) return { error: "Test assignment not found." };
  const a = aRow as { id: string; test_id: string; answers: Record<string, number>; attempts_used: number; best_score: number | null; status: string; location_id: string | null };
  if (a.status === "passed") return { error: "You've already passed this test." };
  if (a.status === "locked") return { error: "This test is locked — a manager needs to unlock it for you." };

  const { data: test } = await admin.from("tests").select("id, title, day_count, pass_pct, max_retakes").eq("id", a.test_id).single();
  const t = test as { id: string; title: string; day_count: number; pass_pct: number; max_retakes: number };

  // Sanitize: only accept numeric answers for this test's questions.
  const { data: qRows } = await admin.from("test_questions").select("id, day_number, correct_index").eq("test_id", a.test_id);
  const questions = (qRows ?? []) as { id: string; day_number: number; correct_index: number }[];
  const valid = new Set(questions.map((q) => q.id));
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(answers)) if (valid.has(k) && Number.isInteger(v)) clean[k] = v;
  const merged = { ...(a.answers || {}), ...clean };
  const now = new Date().toISOString();

  if (dayNumber < t.day_count) {
    await admin.from("test_assignments").update({ answers: merged, current_day: dayNumber + 1, status: "in_progress", updated_at: now }).eq("id", a.id);
    return { error: null, done: false, nextDay: dayNumber + 1 };
  }

  // Final day — score the whole test.
  const { pct } = scoreTest(questions, merged);
  const attemptsUsed = a.attempts_used + 1;
  const best = Math.max(a.best_score ?? 0, pct);
  const outcome = resolveAttempt(pct, t.pass_pct, attemptsUsed, t.max_retakes);

  const patch: Record<string, unknown> = { attempts_used: attemptsUsed, last_score: pct, best_score: best, updated_at: now };
  if (outcome.passed) Object.assign(patch, { status: "passed", passed_at: now, answers: merged });
  else if (outcome.locked) Object.assign(patch, { status: "locked", locked_at: now, answers: merged });
  else Object.assign(patch, { status: "assigned", current_day: 1, answers: {} }); // retake from day 1
  await admin.from("test_assignments").update(patch).eq("id", a.id);

  if (outcome.locked) {
    const { data: o } = await admin.from("organizations").select("notification_settings").eq("id", profile.orgId).maybeSingle();
    if (isNotificationEnabled((o as { notification_settings?: Record<string, boolean> } | null)?.notification_settings ?? null, "test_locked")) {
      await alertLocked(admin, a.id, a.location_id, staffRow.full_name, t.title, pct, attemptsUsed);
    }
  }

  revalidatePath("/training/tests");
  return { error: null, done: true, passed: outcome.passed, locked: outcome.locked, score: pct };
}

// Alert a manager (the email on file for the location the test was taken for)
// that someone has used up their retakes and needs a manual retest.
async function alertLocked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  assignmentId: string,
  locationId: string | null,
  staffName: string,
  testTitle: string,
  score: number,
  attempts: number
): Promise<void> {
  let to = "";
  let locationName = "";
  if (locationId) {
    const { data: loc } = await admin.from("locations").select("email, name").eq("id", locationId).maybeSingle();
    to = (loc?.email || "").trim();
    locationName = loc?.name || "";
  }
  if (!to) to = FALLBACK_ALERT;

  await sendEmail({
    to: [to],
    subject: `Test lock: ${staffName} needs a manual retest — ${testTitle}`,
    html: `<p><strong>${staffName}</strong>${locationName ? ` (${locationName})` : ""} has used up all their attempts on the <strong>${testTitle}</strong> test without passing.</p>
<p>Latest score: <strong>${score}%</strong> · attempts used: ${attempts}.</p>
<p>The test is now locked. Reach out to coach them, then unlock it for a retest from the test's page in Wingman (Training → Tests).</p>`,
  }).catch(() => undefined);

  await admin.from("test_assignments").update({ locked_alerted: true }).eq("id", assignmentId);
}
