"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { normalizeLang } from "@/lib/i18n";

// Save the signed-in user's language preference. Written with the admin client
// keyed strictly to their own verified id (same pattern as the profile loader).
export async function setLanguage(lang: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You're not signed in." };
  const value = normalizeLang(lang);
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ preferred_language: value }).eq("id", profile.userId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null };
}
