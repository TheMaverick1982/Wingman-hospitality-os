import "server-only";

// Transactional email via Resend. Sends from the verified `updates.joinwingman.app`
// subdomain (the root joinwingman.app isn't verified in Resend). Use `replyTo`
// when a human might reply (e.g. support) so replies reach a real inbox.
export const MAIL_FROM = "Wingman <reports@updates.joinwingman.app>";

export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
}: {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY isn't configured yet.");

  const response = await fetch("https://api.resend.com/emails", {
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
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend API returned ${response.status}: ${body.slice(0, 300)}`);
  }
}
