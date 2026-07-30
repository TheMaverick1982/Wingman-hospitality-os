import "server-only";
import { headers } from "next/headers";
import { formTrippedHoneypot } from "@/lib/honeypot";
import { verifyTurnstile } from "@/lib/turnstile";
import { consumeRateLimit } from "@/lib/rate-limit";

// One-call spam guard for any PUBLIC (unauthenticated) form submission — the
// restaurant apply form today, and any customer-facing form we add next. It
// layers the three protections we already ship on login/signup/affiliates so a
// new form just calls this instead of re-wiring them by hand:
//
//   1. Honeypot   — a hidden field naive bots fill (see <HoneypotField/>). The
//                   caller should treat this as a SILENT success (pretend the
//                   submit worked) so the bot moves on without a signal.
//   2. Turnstile  — Cloudflare's invisible CAPTCHA (see <TurnstileWidget/>).
//                   Verified server-side; fails OPEN when unconfigured so it
//                   can't lock real users out before the secret is set.
//   3. Rate limit — optional per-IP fixed window, to blunt scripted floods.
//
// Pair it with <HoneypotField/> and <TurnstileWidget/> inside the <form>.
export type PublicFormGuardResult =
  | { ok: true }
  | { ok: false; reason: "honeypot"; message: null }
  | { ok: false; reason: "turnstile" | "rate"; message: string };

export async function guardPublicForm(
  formData: FormData,
  opts?: { rateKey?: string; max?: number; windowSeconds?: number }
): Promise<PublicFormGuardResult> {
  // Honeypot: no message — the caller pretends success so the bot gets no signal.
  if (formTrippedHoneypot(formData)) {
    return { ok: false, reason: "honeypot", message: null };
  }

  const ip = ((await headers()).get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

  if (!(await verifyTurnstile(formData.get("cf-turnstile-response") as string | null, ip))) {
    return { ok: false, reason: "turnstile", message: "Couldn't verify you're human. Please refresh the page and try again." };
  }

  if (opts?.rateKey) {
    const allowed = await consumeRateLimit(`${opts.rateKey}:${ip}`, opts.max ?? 10, opts.windowSeconds ?? 3600);
    if (!allowed) {
      return { ok: false, reason: "rate", message: "Too many submissions from this connection. Please try again in a little while." };
    }
  }

  return { ok: true };
}
