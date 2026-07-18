import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Web Push sender. Configured from VAPID env; no-ops (returns 0) if the keys
// aren't set, so callers never have to guard. Sends a notification to every
// device a user has subscribed, pruning subscriptions the push service reports
// as gone (404/410). Best-effort — never throws into the caller.

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const CONTACT = process.env.VAPID_CONTACT_EMAIL ?? "mailto:hello@joinwingman.app";

let configured = false;
export function pushConfigured(): boolean {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

type SubRow = { id: string; subscription: webpush.PushSubscription };

// Send to one user's devices. Returns the number of successful deliveries.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured() || !userId) return 0;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("push_subscriptions").select("id, subscription").eq("user_id", userId);
    const rows = (data ?? []) as SubRow[];
    if (rows.length === 0) return 0;

    const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/", tag: payload.tag });
    let delivered = 0;
    const dead: string[] = [];
    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, body);
          delivered++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) dead.push(row.id); // subscription gone
          else console.error("[push] send failed", status ?? e);
        }
      }),
    );
    if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
    if (delivered) await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("user_id", userId);
    return delivered;
  } catch (e) {
    console.error("[push] sendPushToUser failed", e);
    return 0;
  }
}
