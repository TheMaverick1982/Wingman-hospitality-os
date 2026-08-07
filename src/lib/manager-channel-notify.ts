import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { isNotificationEnabled, type NotificationSettings } from "@/lib/notifications";

// Alert the other managers when someone starts a new thread in the manager
// channel. Best-effort: push to every other owner/manager/shift-lead (instant,
// free) plus an email to their own addresses (gated by the org's
// "manager_channel" setting). Replies don't alert — only new posts.

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function alertManagersOfChannelPost(
  admin: SupabaseClient,
  p: { orgId: string; authorId: string; authorName: string; body: string }
): Promise<void> {
  const { data: managers } = await admin
    .from("profiles")
    .select("id, access_role")
    .eq("org_id", p.orgId)
    .in("access_role", ["super_admin", "manager", "shift_lead"]);

  const recipientIds = ((managers ?? []) as { id: string }[]).map((m) => m.id).filter((id) => id !== p.authorId);
  if (recipientIds.length === 0) return;

  const payload = {
    title: `${p.authorName} posted in the manager channel`,
    body: p.body.slice(0, 140),
    url: "/manager-channel",
    tag: "manager-channel",
  };
  await Promise.all(recipientIds.map((id) => sendPushToUser(id, payload).catch(() => 0)));

  // Email the other managers directly, if the org hasn't turned this alert off.
  const { data: org } = await admin
    .from("organizations")
    .select("notification_settings")
    .eq("id", p.orgId)
    .maybeSingle();
  const settings = (org as { notification_settings?: NotificationSettings } | null)?.notification_settings ?? null;
  if (!isNotificationEnabled(settings ?? null, "manager_channel")) return;

  const emails = (
    await Promise.all(
      recipientIds.map(async (id) => {
        try {
          const { data } = await admin.auth.admin.getUserById(id);
          return (data?.user?.email ?? "").trim();
        } catch {
          return "";
        }
      })
    )
  ).filter((e) => e && e.includes("@"));
  if (emails.length === 0) return;

  await sendEmail({
    to: emails,
    subject: `New manager channel post from ${p.authorName} — Wingman`,
    html: `<p><strong>${escapeHtml(p.authorName)}</strong> posted in your team's manager channel:</p>
<blockquote>${escapeHtml(p.body)}</blockquote>
<p><a href="${APP_URL}/manager-channel">Open the manager channel &rarr;</a></p>`,
  }).catch(() => undefined);
}
