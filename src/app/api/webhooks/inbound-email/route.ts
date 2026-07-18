import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Inbound email webhook for reply-routing. When a client replies to a
// conversation email whose Reply-To was reply+<contactId>@<inbound domain>, the
// inbound provider (Resend inbound) POSTs the parsed message here and we thread it
// as email_in. Used for Google-sent and Resend-fallback conversations; Microsoft
// replies are polled from the mailbox instead.
//
// Dormant until an inbound domain (INBOUND_EMAIL_DOMAIN) + provider webhook are
// configured. Verified with a shared secret in INBOUND_EMAIL_SECRET when set.
export const maxDuration = 30;

const CONTACT_RE = /reply\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i;

function clip(v: unknown, n: number): string {
  return typeof v === "string" ? v.slice(0, n) : "";
}

// Pull the recipient list out of whatever shape the provider sends.
function collectRecipients(payload: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const x of v) {
      if (typeof x === "string") out.push(x);
      else if (x && typeof x === "object" && typeof (x as { address?: string }).address === "string") out.push((x as { address: string }).address);
    }
  };
  push(payload.to);
  push(payload.To);
  push((payload as { envelope?: { to?: unknown } }).envelope?.to);
  push((payload as { data?: { to?: unknown } }).data?.to);
  return out;
}

export async function POST(request: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (secret) {
    const provided = request.headers.get("x-webhook-secret") || new URL(request.url).searchParams.get("secret") || "";
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ ok: true, ignored: "no-body" });

  const recipients = collectRecipients(payload);
  let contactId = "";
  for (const r of recipients) {
    const m = r.match(CONTACT_RE);
    if (m) {
      contactId = m[1];
      break;
    }
  }
  if (!contactId) return NextResponse.json({ ok: true, ignored: "no-contact-id" });

  const subject = clip(payload.subject ?? (payload as { Subject?: string }).Subject, 300);
  const text = clip(payload.text ?? (payload as { text_body?: string }).text_body ?? (payload as { stripped_text?: string }).stripped_text ?? payload.body, 4000);
  const fromAddr = clip(payload.from ?? (payload as { From?: string }).From, 300);

  const admin = createAdminClient();
  const { data: c } = await admin.from("crm_contacts").select("id").eq("id", contactId).maybeSingle();
  if (!c) return NextResponse.json({ ok: true, ignored: "unknown-contact" });

  const nowIso = new Date().toISOString();
  await admin.from("crm_activities").insert({
    contact_id: contactId,
    kind: "email_in",
    subject,
    body: text,
    meta: { source: "inbound-email", from: fromAddr },
  });
  await admin
    .from("crm_contacts")
    .update({ last_message_at: nowIso, last_inbound_at: nowIso, last_activity_at: nowIso, updated_at: nowIso })
    .eq("id", contactId);

  return NextResponse.json({ ok: true, threaded: true });
}
