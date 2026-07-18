"use server";

import { headers } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

type PushSub = { endpoint: string; keys?: { p256dh?: string; auth?: string } };

// Store (or refresh) a browser's push subscription for the signed-in user.
export async function savePushSubscription(sub: PushSub): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Invalid subscription." };
  const ua = (await headers()).get("user-agent")?.slice(0, 400) ?? null;
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    { user_id: profile.userId, endpoint: sub.endpoint, subscription: sub, user_agent: ua, last_used_at: new Date().toISOString() },
    { onConflict: "endpoint" },
  );
  return { error: error?.message ?? null };
}

// Remove a subscription (this browser turned notifications off).
export async function removePushSubscription(endpoint: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!endpoint) return { error: null };
  const admin = createAdminClient();
  // Scope to the caller so one user can't delete another's subscription.
  const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", profile.userId);
  return { error: error?.message ?? null };
}

// Send a test notification to the signed-in user's devices.
export async function sendTestPush(): Promise<{ error: string | null; delivered: number }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in.", delivered: 0 };
  const delivered = await sendPushToUser(profile.userId, {
    title: "Wingman",
    body: "Push notifications are on. You're all set.",
    url: "/dashboard",
    tag: "wm-test",
  });
  return { error: delivered ? null : "No active devices received it — try re-enabling.", delivered };
}
