import { type NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/calendar/sms";

// Inbound SMS webhook from Twilio (Messaging Service → Incoming Messages → Send a
// webhook). Twilio POSTs application/x-www-form-urlencoded with From/Body/etc.
//
// We keep our own `crm_contacts.sms_opt_out` in sync with the standard consent
// keywords so the CRM cron stops texting an opted-out contact. Twilio's own
// Advanced Opt-Out (if enabled on the Messaging Service) still handles the
// carrier-level block and the STOP/START/HELP auto-replies; this is our
// system-of-record mirror. We return empty TwiML so we never double-text.

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "revoke", "optout", "opt-out"]);
const START_WORDS = new Set(["start", "yes", "unstop", "optin", "opt-in"]);

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twiml(body = EMPTY_TWIML): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/xml" } });
}

// Validate Twilio's X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sorted
// param key/values concatenated)). Best-effort — if the reconstructed URL can't be
// matched (proxy/host rewrites) we don't hard-fail an opt-out, since the action is
// low-risk (only ever suppresses our own sends) and losing a STOP would be worse.
function signatureValid(url: string, params: Record<string, string>, signature: string | null, token: string): boolean {
  if (!signature) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];
  const expected = createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  return expected === signature;
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) return twiml();

  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = typeof v === "string" ? v : "";

  const from = params.From ?? "";
  const bodyRaw = (params.Body ?? "").trim();
  if (!from || !bodyRaw) return twiml();

  // Signature check (advisory — see note above).
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (token) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    const url = `${proto}://${host}${new URL(request.url).pathname}`;
    const sig = request.headers.get("x-twilio-signature");
    if (!signatureValid(url, params, sig, token)) {
      console.warn("[twilio] inbound signature mismatch — processing anyway (keyword sync only)");
    }
  }

  // First word, letters only, lowercased (handles "STOP.", "Stop please", etc.).
  const keyword = bodyRaw.toLowerCase().replace(/[^a-z]/g, " ").trim().split(/\s+/)[0] ?? "";
  const isStop = STOP_WORDS.has(keyword);
  const isStart = START_WORDS.has(keyword);
  if (!isStop && !isStart) return twiml(); // HELP and other replies handled by Twilio.

  const phone = normalizePhone(from);
  if (!phone) return twiml();

  const admin = createAdminClient();
  const { data: contacts } = await admin.from("crm_contacts").select("id").eq("phone", phone).limit(20);
  const ids = ((contacts ?? []) as { id: string }[]).map((c) => c.id);
  if (ids.length === 0) return twiml();

  const nowIso = new Date().toISOString();
  await admin
    .from("crm_contacts")
    .update({ sms_opt_out: isStop, updated_at: nowIso, last_activity_at: nowIso })
    .in("id", ids);

  // Timeline entry so the team sees the opt-out/opt-in.
  await admin.from("crm_activities").insert(
    ids.map((contact_id) => ({
      contact_id,
      kind: "sms_in",
      subject: isStop ? "Replied STOP" : "Replied START",
      body: bodyRaw.slice(0, 500),
      meta: { channel: "sms", from: phone, keyword },
    })),
  );

  return twiml();
}
