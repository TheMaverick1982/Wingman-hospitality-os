"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";

export type ForgotPasswordState = { error: string | null; sent: boolean };

// Password reset uses a STATELESS token_hash recovery link, generated server-side
// and delivered by our own (Resend) email — deliberately NOT resetPasswordForEmail.
//
// resetPasswordForEmail runs the PKCE flow: it stashes a code_verifier cookie in
// the browser that requested the reset, and exchangeCodeForSession later needs
// that exact cookie. People almost always open the reset email on a DIFFERENT
// device than they requested it on (desktop → phone), so the verifier is missing,
// the exchange fails, and they bounce back and request again — an endless loop.
//
// A token_hash link (verified in /auth/callback with verifyOtp) needs no cookie,
// so it works on any device. We generate it with the admin API and send it
// ourselves, which also keeps reset emails on the same branded Resend pipeline as
// everything else.
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address.", sent: false };

  // Trusted, server-configured base URL (not the client Origin header) so the
  // reset link can't be pointed at another host.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "https://www.joinwingman.app").replace(/\/$/, "");

  // Rate-limit per email so this can't be used to bomb someone's inbox with reset
  // mail (resetPasswordForEmail had built-in limits; our own send needs its own).
  // Over the limit we still report success below — never reveal account existence.
  const allowed = await consumeRateLimit(`pwreset:${email}`, 4, 900);

  if (allowed) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
      const hash = (data as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
      // generateLink errors for an unknown email — swallow it (privacy) so the
      // response is identical whether or not an account exists.
      if (!error && hash) {
        const link = `${origin}/auth/callback?token_hash=${encodeURIComponent(hash)}&type=recovery`;
        const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.6;max-width:560px;">
          <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#0a6cff;margin:0 0 8px;">Wingman</p>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 12px;">Reset your password</h1>
          <p style="margin:0 0 16px;">Click the button below to choose a new password for your Wingman account. This link expires shortly, so use it soon.</p>
          <p style="margin:0 0 20px;"><a href="${link}" style="display:inline-block;background:#0a6cff;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 22px;border-radius:9999px;">Reset your password</a></p>
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">If the button doesn&rsquo;t work, paste this link into your browser:</p>
          <p style="margin:0 0 16px;font-size:12px;color:#6b7280;word-break:break-all;">${link}</p>
          <p style="margin:0;font-size:13px;color:#9ca3af;">Didn&rsquo;t request this? You can safely ignore this email — your password won&rsquo;t change.</p>
        </div>`;
        await sendEmail({ to: [email], subject: "Reset your Wingman password", html }).catch(() => undefined);
      }
    } catch {
      // Never surface whether the email exists, or any internal error.
    }
  }

  // Always report success regardless of whether the email exists (or was rate-
  // limited), so this endpoint can't be used to discover which emails have
  // accounts.
  return { error: null, sent: true };
}
