import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMailViaGraph, listRecentMail, hasMailSend, hasMailRead, type MicrosoftAccountRow } from "@/lib/calendar/microsoft";

// Provider-agnostic "send from the rep's own connected mailbox" for 1:1 client
// conversations. Microsoft 365 (Graph) today; Google send is layered on later.
// Bulk marketing never comes through here — it stays on Resend.

export type MailboxSend = { sent: boolean; from?: string; provider?: "microsoft" | "google"; error?: string };

// Does this user have a mailbox connected that can SEND (for the composer to hint
// whether email will go from their address vs the shared Resend fallback)?
export async function userSendMailbox(userId: string): Promise<{ provider: "microsoft"; email: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("calendar_microsoft_accounts").select("email, scopes").eq("user_id", userId);
  const ms = ((data ?? []) as { email: string; scopes: string }[]).find((a) => hasMailSend(a.scopes));
  return ms ? { provider: "microsoft", email: ms.email } : null;
}

// Try to send from the user's own mailbox. Returns sent:false if they have no
// send-capable mailbox (caller falls back to Resend) or the provider errored.
export async function sendViaUserMailbox(
  userId: string,
  opts: { toEmail: string; toName?: string; subject: string; html: string; replyTo?: string },
): Promise<MailboxSend> {
  const admin = createAdminClient();
  const { data } = await admin.from("calendar_microsoft_accounts").select("*").eq("user_id", userId);
  const ms = ((data ?? []) as MicrosoftAccountRow[]).find((a) => hasMailSend(a.scopes));
  if (ms) {
    const res = await sendMailViaGraph(ms, opts);
    return res.ok ? { sent: true, from: ms.email, provider: "microsoft" } : { sent: false, error: res.error, provider: "microsoft" };
  }
  return { sent: false };
}

// Poll every connected Microsoft mailbox for replies from known contacts and
// thread them as email_in. Only messages matching an existing CRM contact are
// stored — the rep's newsletters/other mail are ignored. Best-effort per account.
export async function syncMicrosoftInbound(): Promise<{ accounts: number; ingested: number }> {
  const admin = createAdminClient();
  const { data } = await admin.from("calendar_microsoft_accounts").select("*");
  const accounts = ((data ?? []) as (MicrosoftAccountRow & { mail_synced_at?: string | null })[]).filter((a) => hasMailRead(a.scopes));
  let ingested = 0;

  for (const acct of accounts) {
    const selfEmail = (acct.email ?? "").toLowerCase();
    let cursor = acct.mail_synced_at ?? null;
    let messages;
    try {
      messages = await listRecentMail(acct, cursor);
    } catch {
      continue;
    }

    for (const m of messages) {
      if (m.receivedAt && (!cursor || m.receivedAt > cursor)) cursor = m.receivedAt;
      if (!m.fromEmail || m.fromEmail === selfEmail) continue;

      const { data: c } = await admin.from("crm_contacts").select("id").eq("email", m.fromEmail).maybeSingle();
      const contactId = (c as { id: string } | null)?.id;
      if (!contactId) continue; // only thread known contacts

      // Dedup: record the message id; a conflict means we already threaded it.
      const { error: seenErr } = await admin.from("mailbox_seen").insert({ message_id: m.id });
      if (seenErr) continue;

      const nowIso = new Date().toISOString();
      await admin.from("crm_activities").insert({
        contact_id: contactId,
        kind: "email_in",
        subject: m.subject,
        body: m.preview,
        meta: { source: "mailbox", provider: "microsoft", message_id: m.id, from: m.fromEmail, mailbox: acct.email },
      });
      await admin
        .from("crm_contacts")
        .update({ last_message_at: nowIso, last_inbound_at: nowIso, last_activity_at: nowIso, updated_at: nowIso })
        .eq("id", contactId);
      ingested++;
    }

    if (cursor && cursor !== acct.mail_synced_at) {
      await admin.from("calendar_microsoft_accounts").update({ mail_synced_at: cursor }).eq("id", acct.id);
    }
  }
  return { accounts: accounts.length, ingested };
}
