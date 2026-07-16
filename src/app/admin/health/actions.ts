"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ErrorEvent } from "./health-client";
import { RESOLVED_PAGE_SIZE, ERROR_COLS } from "./constants";

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

// Fetch an older page of resolved errors for "Load more".
export async function loadMoreResolvedErrors(offset: number): Promise<{ rows: ErrorEvent[]; hasMore: boolean; error: string | null }> {
  const actor = await platformSectionActor("health");
  if (!actor) return { rows: [], hasMore: false, error: "Not authorized." };
  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const admin = createAdminClient();
  const { data } = await admin
    .from("error_events")
    .select(ERROR_COLS)
    .eq("resolved", true)
    .order("last_seen", { ascending: false })
    .range(safeOffset, safeOffset + RESOLVED_PAGE_SIZE - 1);
  const rows = (data ?? []) as ErrorEvent[];
  return { rows, hasMore: rows.length === RESOLVED_PAGE_SIZE, error: null };
}
