import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Best-effort daily send counter (email / sms) feeding the capacity watchdog's
// month-to-date volume checks. Never throws into the caller — a missed increment
// just slightly undercounts, it must not break a send.
export async function bumpProviderUsage(channel: "email" | "sms", n = 1): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("bump_provider_usage", { p_channel: channel, p_n: n });
  } catch (e) {
    console.error("[usage] bumpProviderUsage failed", e);
  }
}
