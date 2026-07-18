import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMailViaGraph, hasMailSend, type MicrosoftAccountRow } from "@/lib/calendar/microsoft";

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
