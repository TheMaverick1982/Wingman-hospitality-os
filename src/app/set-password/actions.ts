"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SetPasswordState = { error: string | null };

export async function setPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Honor a safe in-app return path (affiliates return to their dashboard);
  // reject anything that isn't a plain relative path to avoid open redirects.
  const rawNext = String(formData.get("next") || "");
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "/dashboard";
  redirect(next);
}
