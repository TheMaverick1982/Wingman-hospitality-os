// Shared honeypot spam trap.
//
// `HONEYPOT_FIELD` is the name of a form input that is rendered hidden from
// real users (see <HoneypotField/>), so a human never fills it. Naive spam
// bots, which fill every field they find, populate it — and server actions
// treat any non-empty value as a bot and silently drop the submission.
//
// This is a cheap first filter, NOT a real security control. It stops the bulk
// of low-effort automated spam; a CAPTCHA (Cloudflare Turnstile) is the layer
// that stops determined/distributed bots.
export const HONEYPOT_FIELD = "website";

export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function formTrippedHoneypot(formData: FormData): boolean {
  return isHoneypotFilled(formData.get(HONEYPOT_FIELD));
}
