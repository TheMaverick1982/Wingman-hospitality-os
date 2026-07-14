"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSocialDrafts } from "@/lib/social-cards/generate";

// Manually generate a batch of draft posts (owner clicks "Generate drafts").
export async function generateDraftsAction(count: number): Promise<{ error: string | null; created: number }> {
  if (!(await platformSectionActor("social"))) return { error: "Not authorized.", created: 0 };
  const res = await generateSocialDrafts(count);
  revalidatePath("/admin/social");
  return res;
}

// Save the content brief + the auto-generate-on-low-runway switch.
export async function saveContentBrief(brief: string, autoGenerate: boolean): Promise<{ error: string | null }> {
  if (!(await platformSectionActor("social"))) return { error: "Not authorized." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("social_settings")
    .update({ content_brief: (brief || "").slice(0, 20000), auto_generate: !!autoGenerate })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/admin/social");
  return { error: null };
}
