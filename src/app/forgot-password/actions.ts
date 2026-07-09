"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = { error: string | null; sent: boolean };

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Enter your email address.", sent: false };

  // Trusted, server-configured base URL (not the client Origin header) so the
  // reset link can't be pointed at another host.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin");

  const supabase = await createClient();
  // The recovery link routes back through /auth/callback (which exchanges the
  // code for a session), then on to /set-password.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?type=recovery`,
  });

  // Always report success regardless of whether the email exists, so this
  // endpoint can't be used to discover which emails have accounts.
  return { error: null, sent: true };
}
