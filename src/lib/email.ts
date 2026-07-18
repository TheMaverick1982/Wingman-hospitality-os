import "server-only";
import { bumpProviderUsage } from "@/lib/provider-usage";
import { fetchWithRetry } from "@/lib/fetch-retry";

// Transactional email via Resend. Sends from the verified `updates.joinwingman.app`
// subdomain (the root joinwingman.app isn't verified in Resend). Use `replyTo`
// when a human might reply (e.g. support) so replies reach a real inbox.
export const MAIL_FROM = "Wingman <reports@updates.joinwingman.app>";

// An attachment for Resend. `content` is base64-encoded file bytes. Used for the
// booking confirmation's .ics calendar invite.
export type EmailAttachment = {
  filename: string;
  content: string; // base64
  contentType?: string;
};

export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
  cc,
  attachments,
}: {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  attachments?: EmailAttachment[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY isn't configured yet.");

  const response = await fetchWithRetry("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from ?? MAIL_FROM,
      to,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(cc && cc.length ? { cc } : {}),
      ...(attachments && attachments.length
        ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, ...(a.contentType ? { content_type: a.contentType } : {}) })) }
        : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend API returned ${response.status}: ${body.slice(0, 300)}`);
  }

  // Count the send for the capacity watchdog (best-effort). One recipient list =
  // one Resend call = one billed send.
  await bumpProviderUsage("email");
}
