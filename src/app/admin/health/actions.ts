"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";

export async function resolveError(id: string): Promise<{ error: string | null }> {
  const actor = await platformSectionActor("health");
  if (!actor) return { error: "Not authorized." };
  const admin = createAdminClient();
  await admin.from("error_events").update({ resolved: true }).eq("id", id);
  revalidatePath("/admin/health");
  return { error: null };
}

export async function reopenError(id: string): Promise<{ error: string | null }> {
  const actor = await platformSectionActor("health");
  if (!actor) return { error: "Not authorized." };
  const admin = createAdminClient();
  await admin.from("error_events").update({ resolved: false }).eq("id", id);
  revalidatePath("/admin/health");
  return { error: null };
}
