import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { isNotificationEnabled, type NotificationSettings } from "@/lib/notifications";

// Alerts for the staff → manager question escalation (Ask Wingman, Phase 2).
// Both directions are best-effort: push to the person's devices (instant, free)
// plus an email fallback. Nothing here throws into the caller.

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ManagerRow = { id: string; access_role: string; location_id: string | null };

// Alert the asker's location managers + owners that a new question came in.
// Push goes to every owner (super_admin) and every manager/shift-lead at the
// asker's location; email goes to that location's address on file (gated by the
// org's "staff_question" notification setting), matching the existing manager
// alert pattern.
export async function alertManagersOfQuestion(
  admin: SupabaseClient,
  q: { orgId: string; locationId: string | null; askerName: string; question: string }
): Promise<void> {
  const { data: managers } = await admin
    .from("profiles")
    .select("id, access_role, location_id")
    .eq("org_id", q.orgId)
    .in("access_role", ["super_admin", "manager", "shift_lead"]);

  const recipients = ((managers ?? []) as ManagerRow[]).filter(
    (m) => m.access_role === "super_admin" || !q.locationId || m.location_id === q.locationId
  );

  const payload = {
    title: `Question from ${q.askerName}`,
    body: q.question.slice(0, 140),
    url: "/questions",
    tag: "staff-question",
  };
  await Promise.all(recipients.map((m) => sendPushToUser(m.id, payload).catch(() => 0)));

  // Email the location on file, if the org hasn't turned this alert off.
  const { data: org } = await admin
    .from("organizations")
    .select("notification_settings")
    .eq("id", q.orgId)
    .maybeSingle();
  const settings = (org as { notification_settings?: NotificationSettings } | null)?.notification_settings ?? null;
  if (!isNotificationEnabled(settings ?? null, "staff_question")) return;

  let to = "";
  if (q.locationId) {
    const { data: loc } = await admin.from("locations").select("email").eq("id", q.locationId).maybeSingle();
    to = ((loc as { email?: string } | null)?.email || "").trim();
  }
  if (!to || !to.includes("@")) return; // no email on file — push already went out

  await sendEmail({
    to: [to],
    subject: `New question from ${q.askerName} — Wingman`,
    html: `<p><strong>${escapeHtml(q.askerName)}</strong> asked a question in Wingman that needs a manager's answer:</p>
<blockquote>${escapeHtml(q.question)}</blockquote>
<p><a href="${APP_URL}/questions">Answer it in Wingman &rarr;</a></p>`,
  }).catch(() => undefined);
}

// Tell the asker their question was answered — push to their devices + email.
export async function notifyAskerOfAnswer(
  a: { askerUserId: string | null; askerEmail: string | null; question: string; answer: string }
): Promise<void> {
  if (a.askerUserId) {
    await sendPushToUser(a.askerUserId, {
      title: "Your question was answered",
      body: a.answer.slice(0, 140),
      url: "/questions",
      tag: "staff-question-answer",
    }).catch(() => 0);
  }
  const email = (a.askerEmail || "").trim();
  if (!email || !email.includes("@")) return;
  await sendEmail({
    to: [email],
    subject: "Your Wingman question was answered",
    html: `<p>Your question:</p>
<blockquote>${escapeHtml(a.question)}</blockquote>
<p>Answer:</p>
<blockquote>${escapeHtml(a.answer)}</blockquote>
<p><a href="${APP_URL}/questions">See it in Wingman &rarr;</a></p>`,
  }).catch(() => undefined);
}
