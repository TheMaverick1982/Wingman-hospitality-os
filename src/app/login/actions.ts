"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoEmail } from "@/lib/demo/constants";
import { ensureDemoUser, reseedDemoOrg } from "@/lib/demo/reseed";

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  // Demo account: guarantee it exists with the known password before we try to
  // sign in, so the very first login (and any password rotation) self-heals.
  if (isDemoEmail(email)) {
    try {
      await ensureDemoUser();
    } catch (e) {
      console.error("[demo] ensureDemoUser failed", e);
    }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // On every successful demo sign-in, wipe + repopulate the demo org so each
  // viewer starts from the same clean, fully-populated showcase.
  if (isDemoEmail(email)) {
    try {
      await reseedDemoOrg();
    } catch (e) {
      // Don't block login if the reseed hiccups — they still land in a working
      // (if stale) demo. The next login will try again.
      console.error("[demo] reseedDemoOrg failed", e);
    }
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
