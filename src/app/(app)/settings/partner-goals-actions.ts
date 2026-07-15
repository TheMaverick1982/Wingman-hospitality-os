"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";

export type ActionState = { error: string | null; ok?: boolean };

function toInt(raw: string, fallback: number): number {
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Owner-only. Saves the org-wide default goals plus any per-location overrides.
// A location whose fields are all left blank inherits the default (its override
// row is removed); otherwise its override is upserted (blank fields fall back to
// the default value).
export async function updatePartnerGoals(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the account owner can set goals." };

  const supabase = await createClient();

  const def = {
    goal_new_contacts: toInt(String(formData.get("default_new") || ""), 20),
    goal_events: toInt(String(formData.get("default_events") || ""), 3),
    goal_fundraisers: toInt(String(formData.get("default_fundraisers") || ""), 3),
    goal_active_connections: toInt(String(formData.get("default_active") || ""), 20),
  };

  // Org-wide default row (location_id null). Manual select-then-write since the
  // unique index is partial (PostgREST upsert can't target it reliably).
  {
    const { data: existing } = await supabase.from("partner_goals").select("id").is("location_id", null).maybeSingle();
    if (existing) {
      await supabase.from("partner_goals").update({ ...def, updated_at: new Date().toISOString() }).eq("id", (existing as { id: string }).id);
    } else {
      const { error } = await supabase.from("partner_goals").insert({ org_id: profile.orgId, location_id: null, ...def });
      if (error) return { error: error.message };
    }
  }

  // Per-location overrides.
  const locationIds = formData.getAll("location_id").map(String);
  for (const locId of locationIds) {
    if (!locId) continue;
    const raw = {
      n: String(formData.get(`loc_${locId}_new`) || "").trim(),
      e: String(formData.get(`loc_${locId}_events`) || "").trim(),
      f: String(formData.get(`loc_${locId}_fundraisers`) || "").trim(),
      a: String(formData.get(`loc_${locId}_active`) || "").trim(),
    };
    const allBlank = !raw.n && !raw.e && !raw.f && !raw.a;
    const { data: existing } = await supabase
      .from("partner_goals")
      .select("id")
      .eq("location_id", locId)
      .maybeSingle();

    if (allBlank) {
      if (existing) await supabase.from("partner_goals").delete().eq("id", (existing as { id: string }).id);
      continue;
    }
    const row = {
      goal_new_contacts: toInt(raw.n, def.goal_new_contacts),
      goal_events: toInt(raw.e, def.goal_events),
      goal_fundraisers: toInt(raw.f, def.goal_fundraisers),
      goal_active_connections: toInt(raw.a, def.goal_active_connections),
    };
    if (existing) {
      await supabase.from("partner_goals").update({ ...row, updated_at: new Date().toISOString() }).eq("id", (existing as { id: string }).id);
    } else {
      const { error } = await supabase.from("partner_goals").insert({ org_id: profile.orgId, location_id: locId, ...row });
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/settings");
  revalidatePath("/partners");
  return { error: null, ok: true };
}

// Owner-only. Sets the address that also receives the monthly Partners rollup
// (accounting / HR / leadership). Blank clears it — the rollup then goes to the
// account owner only.
export async function updatePartnersReportEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the account owner can change this." };

  const email = String(formData.get("reportEmail") || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ partners_report_email: email || null }).eq("id", profile.orgId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null, ok: true };
}
