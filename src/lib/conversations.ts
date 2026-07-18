import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email";
import { buildSequenceEmailHtml } from "@/lib/crm-sequences";
import { CRM_REPLY_TO } from "@/lib/crm-merge";
import { twilioConfigured, normalizePhone, sendSms } from "@/lib/calendar/sms";
import { sendViaUserMailbox } from "@/lib/mailbox";

// Platform-admin Conversations: a unified email + SMS inbox over crm_contacts +
// crm_activities. The message history is the existing activity log; this adds the
// inbox roll-up, the thread, and the send paths.

const MESSAGE_KINDS = ["email_out", "email_in", "sms_out", "sms_in"] as const;

export type ConversationRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  lastMessageAt: string | null;
  preview: string;
  lastKind: string;
  unread: boolean;
};

export type ThreadMessage = { id: string; kind: string; subject: string | null; body: string | null; created_at: string };

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) throw new Error("Not authorized.");
  return profile;
}

export async function listConversations(limit = 50): Promise<ConversationRow[]> {
  const admin = createAdminClient();
  const { data: contacts } = await admin
    .from("crm_contacts")
    .select("id, name, email, phone, last_message_at, last_inbound_at, convo_read_at")
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  const rows = (contacts ?? []) as {
    id: string; name: string | null; email: string; phone: string | null;
    last_message_at: string | null; last_inbound_at: string | null; convo_read_at: string | null;
  }[];
  if (rows.length === 0) return [];

  // Latest message per contact for the preview (one query, dedupe in JS).
  const ids = rows.map((r) => r.id);
  const { data: acts } = await admin
    .from("crm_activities")
    .select("contact_id, kind, subject, body, created_at")
    .in("contact_id", ids)
    .in("kind", MESSAGE_KINDS as unknown as string[])
    .order("created_at", { ascending: false })
    .limit(400);
  const latest = new Map<string, { kind: string; subject: string | null; body: string | null }>();
  for (const a of (acts ?? []) as { contact_id: string; kind: string; subject: string | null; body: string | null }[]) {
    if (!latest.has(a.contact_id)) latest.set(a.contact_id, a);
  }

  return rows.map((r) => {
    const m = latest.get(r.id);
    const text = (m?.body || m?.subject || "").replace(/\s+/g, " ").trim();
    const inboundAt = r.last_inbound_at ? new Date(r.last_inbound_at).getTime() : 0;
    const readAt = r.convo_read_at ? new Date(r.convo_read_at).getTime() : 0;
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      lastMessageAt: r.last_message_at,
      preview: text.length > 120 ? `${text.slice(0, 120)}…` : text,
      lastKind: m?.kind ?? "",
      unread: inboundAt > readAt,
    };
  });
}

export async function getThread(contactId: string): Promise<{ contact: { id: string; name: string | null; email: string; phone: string | null }; messages: ThreadMessage[] } | null> {
  const admin = createAdminClient();
  const { data: c } = await admin.from("crm_contacts").select("id, name, email, phone").eq("id", contactId).maybeSingle();
  if (!c) return null;
  const { data: msgs } = await admin
    .from("crm_activities")
    .select("id, kind, subject, body, created_at")
    .eq("contact_id", contactId)
    .in("kind", MESSAGE_KINDS as unknown as string[])
    .order("created_at", { ascending: true })
    .limit(500);
  return { contact: c as { id: string; name: string | null; email: string; phone: string | null }, messages: (msgs ?? []) as ThreadMessage[] };
}

// Mark a thread read (admin opened it).
export async function markConversationRead(contactId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("crm_contacts").update({ convo_read_at: new Date().toISOString() }).eq("id", contactId);
}

async function touchOutbound(admin: ReturnType<typeof createAdminClient>, contactId: string, nowIso: string) {
  await admin.from("crm_contacts").update({ last_message_at: nowIso, last_activity_at: nowIso, updated_at: nowIso }).eq("id", contactId);
}

// A plain, personal-looking HTML wrapper for 1:1 conversation email — no
// marketing/unsubscribe footer (this comes from a real person, not a campaign).
function personalHtml(body: string): string {
  const esc = (t: string) => t.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
  const inner = esc(body)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;">${inner}</div>`;
}

export async function sendConversationEmail(contactId: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireAdmin();
  const s = subject.trim();
  const b = body.trim();
  if (!s || !b) return { ok: false, error: "Subject and message are both required." };
  const admin = createAdminClient();
  const { data: c } = await admin.from("crm_contacts").select("id, name, email").eq("id", contactId).maybeSingle();
  const contact = c as { id: string; name: string | null; email: string } | null;
  if (!contact?.email) return { ok: false, error: "This contact has no email address." };
  if (contact.email.endsWith("@sms.wingman.local")) return { ok: false, error: "This contact has no real email address (SMS-only)." };

  // Prefer the rep's own connected mailbox (M365 → from their real address);
  // fall back to Resend from the shared app domain.
  let via = "resend";
  let from: string | undefined;
  const mailbox = await sendViaUserMailbox(profile.userId, { toEmail: contact.email, toName: contact.name ?? undefined, subject: s, html: personalHtml(b) });
  if (mailbox.sent) {
    via = mailbox.provider ?? "mailbox";
    from = mailbox.from;
  } else {
    try {
      await sendEmail({ to: [contact.email], subject: s, html: buildSequenceEmailHtml(b, contact.email), replyTo: CRM_REPLY_TO });
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  const nowIso = new Date().toISOString();
  await admin.from("crm_activities").insert({ contact_id: contactId, kind: "email_out", subject: s, body: b, meta: { source: "conversations", to: contact.email, via, from } });
  await touchOutbound(admin, contactId, nowIso);
  return { ok: true };
}

export async function sendConversationSms(contactId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const b = body.trim();
  if (!b) return { ok: false, error: "Message is required." };
  if (!twilioConfigured()) return { ok: false, error: "Twilio isn't configured." };
  const admin = createAdminClient();
  const { data: c } = await admin.from("crm_contacts").select("id, phone, sms_opt_out").eq("id", contactId).maybeSingle();
  const contact = c as { id: string; phone: string | null; sms_opt_out: boolean } | null;
  const to = normalizePhone(contact?.phone ?? "");
  if (!to) return { ok: false, error: "This contact has no mobile number." };
  if (contact?.sms_opt_out) return { ok: false, error: "This contact replied STOP — you can't text them." };
  const res = await sendSms(to, b);
  if (!res.ok) return { ok: false, error: res.error ?? "Twilio rejected the message." };
  const nowIso = new Date().toISOString();
  await admin.from("crm_activities").insert({ contact_id: contactId, kind: "sms_out", subject: "", body: b, meta: { source: "conversations", to } });
  await touchOutbound(admin, contactId, nowIso);
  return { ok: true };
}
