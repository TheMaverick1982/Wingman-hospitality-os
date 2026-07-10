"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { captureReferralForCurrentUser } from "@/lib/affiliate";

export type SignupState = { error: string | null; checkEmail: boolean };

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const orgName = String(formData.get("orgName") || "").trim();
  const locationName = String(formData.get("locationName") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!orgName || !locationName || !fullName || !email || !password) {
    return { error: "All fields are required.", checkEmail: false };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", checkEmail: false };
  }

  const supabase = await createClient();
  const headersList = await headers();
  // Prefer the trusted, server-configured site URL so the confirmation link
  // (which carries the auth code) can't be pointed at an attacker host via a
  // forged Origin/Host header. Falls back to the request header for local dev.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? headersList.get("origin") ?? `https://${headersList.get("host")}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        pending_org_name: orgName,
        pending_location_name: locationName,
        pending_full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: error.message, checkEmail: false };
  }

  if (!data.session) {
    // Email confirmation is required before a session exists; the org gets
    // created in /auth/callback once they confirm and land back with a session.
    return { error: null, checkEmail: true };
  }

  const { error: rpcError } = await supabase.rpc("create_organization", {
    org_name: orgName,
    gm_full_name: fullName,
    first_location_name: locationName,
  });

  if (rpcError) {
    return { error: rpcError.message, checkEmail: false };
  }

  await captureReferralForCurrentUser(supabase);
  redirect("/dashboard");
}
