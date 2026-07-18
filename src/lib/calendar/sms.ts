import "server-only";
import { bumpProviderUsage } from "@/lib/provider-usage";
import { fetchWithRetry } from "@/lib/fetch-retry";

// Transactional SMS via Twilio's REST API (no SDK). Credentials live in Vercel as
// TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN and a sender: TWILIO_MESSAGING_SERVICE_SID
// (preferred) or TWILIO_FROM_NUMBER. SMS is best-effort — a failure never blocks a
// booking.

export function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER),
  );
}

// Best-effort E.164 normalization. Assumes US (+1) for bare 10-digit numbers; a
// number the guest enters with a leading + is kept as-is (minus spacing).
export function normalizePhone(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { ok: false, error: "Twilio isn't configured." };
  const dest = normalizePhone(to);
  if (!dest) return { ok: false, error: "No phone number." };

  const params = new URLSearchParams({ To: dest, Body: body.slice(0, 1500) });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    params.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  } else if (process.env.TWILIO_FROM_NUMBER) {
    params.set("From", process.env.TWILIO_FROM_NUMBER);
  } else {
    return { ok: false, error: "No Twilio sender configured." };
  }

  try {
    const res = await fetchWithRetry(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: json.message ?? `Twilio error (${res.status})` };
    }
    await bumpProviderUsage("sms"); // capacity watchdog (best-effort)
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
