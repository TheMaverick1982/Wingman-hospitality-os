import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { isNotificationEnabled, type NotificationSettings } from "@/lib/notifications";

// Alert for post-shift staff feedback (Shift Hub, Slice 2). Best-effort: push to
// the location's managers + owners (instant, free) plus an email fallback to the
// location on file. Nothing here throws into the caller — a failed alert must
// never fail the staffer's submission. Mirrors alertManagersOfQuestion.

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ManagerRow = { id: string; access_role: string; location_id: string | null };

export async function alertManagersOfFeedback(
  admin: SupabaseClient,
  f: { orgId: string; locationId: string | null; authorName: string; department: string; wentWell: string; improve: string; guestNotes: string }
): Promise<void> {
  const { data: managers } = await admin
    .from("profiles")
    .select("id, access_role, location_id")
    .eq("org_id", f.orgId)
    .in("access_role", ["super_admin", "manager", "shift_lead"]);

  // Every owner (super_admin), plus every manager/shift-lead at this location.
  const recipients = ((managers ?? []) as ManagerRow[]).filter(
    (m) => m.access_role === "super_admin" || !f.locationId || m.location_id === f.locationId
  );

  const who = f.department ? `${f.authorName} · ${f.department}` : f.authorName;
  const preview = (f.wentWell || f.improve || f.guestNotes || "").slice(0, 140);
  await Promise.all(
    recipients.map((m) =>
      sendPushToUser(m.id, {
        title: `Post-shift note from ${f.authorName}`,
        body: preview,
        url: "/shift",
        tag: "shift-feedback",
      }).catch(() => 0)
    )
  );

  // Email the location on file, if the org hasn't turned this alert off.
  const { data: org } = await admin
    .from("organizations")
    .select("notification_settings")
    .eq("id", f.orgId)
    .maybeSingle();
  const settings = (org as { notification_settings?: NotificationSettings } | null)?.notification_settings ?? null;
  if (!isNotificationEnabled(settings ?? null, "shift_feedback")) return;

  let to = "";
  if (f.locationId) {
    const { data: loc } = await admin.from("locations").select("email").eq("id", f.locationId).maybeSingle();
    to = ((loc as { email?: string } | null)?.email || "").trim();
  }
  if (!to || !to.includes("@")) return; // no email on file — push already went out

  const block = (label: string, body: string) =>
    body ? `<p style="margin:0 0 2px"><strong>${label}</strong></p><blockquote style="margin:0 0 12px">${escapeHtml(body)}</blockquote>` : "";

  await sendEmail({
    to: [to],
    subject: `Post-shift note from ${f.authorName} — Wingman`,
    html: `<p><strong>${escapeHtml(who)}</strong> left an end-of-shift note:</p>
${block("What went well", f.wentWell)}${block("What could be better", f.improve)}${block("Anything guests said", f.guestNotes)}
<p><a href="${APP_URL}/shift">See it in Wingman &rarr;</a></p>`,
  }).catch(() => undefined);
}
