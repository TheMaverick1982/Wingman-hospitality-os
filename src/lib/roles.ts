import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { ROLE_SEED } from "@/lib/role-seed";

// A role is "active" for an org iff it has a department_meta row. That's the
// registry of which roles this restaurant actually runs — set by the Setup
// Wizard and managed on the Training / Hiring pages. Training and Hiring show
// only the active roles, not all twelve built-ins.

export async function getActiveDepartments(): Promise<Department[]> {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return [];
  const { data } = await supabase.from("department_meta").select("department").eq("org_id", org.id as string);
  const active = new Set(((data ?? []) as { department: string }[]).map((r) => r.department));
  return ALL_DEPARTMENTS.filter((d) => active.has(d));
}

// Turn a role on for an org: create its department_meta row and, only if the
// role has no content yet, seed starter standards / duties / hiring traits from
// ROLE_SEED (source "custom", matching the original seeded roles). Idempotent —
// re-adding a role that already has content just re-shows it, untouched.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function activateDepartment(supabase: SupabaseClient | any, orgId: string, dept: Department): Promise<void> {
  const seed = ROLE_SEED[dept];
  if (!seed) return;

  const { data: meta } = await supabase
    .from("department_meta")
    .select("department")
    .eq("org_id", orgId)
    .eq("department", dept)
    .maybeSingle();
  if (!meta) {
    await supabase.from("department_meta").insert({ org_id: orgId, department: dept, track_label: seed.trackLabel, has_menu: seed.hasMenu });
  }

  const countFor = async (table: string) => {
    const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("department", dept);
    return count ?? 0;
  };

  if ((await countFor("department_standards")) === 0 && seed.standards.length) {
    await supabase.from("department_standards").insert(
      seed.standards.map((item, i) => ({ org_id: orgId, department: dept, item, sort_order: i, source: "custom" }))
    );
  }
  if ((await countFor("department_training_items")) === 0 && seed.duties.length) {
    await supabase.from("department_training_items").insert(
      seed.duties.map((item, i) => ({ org_id: orgId, department: dept, item, sort_order: i, source: "custom" }))
    );
  }
  if ((await countFor("hiring_traits")) === 0 && seed.hiring.length) {
    await supabase.from("hiring_traits").insert(
      seed.hiring.map((h, i) => ({ org_id: orgId, department: dept, title: h.title, question: h.question, green_flag: h.green_flag, red_flag: h.red_flag, sort_order: i, source: "custom" }))
    );
  }
}

// Turn a role off (hide it). We only remove the department_meta row, so the
// role disappears from Training / Hiring but its content and any history are
// preserved — re-adding restores it exactly as it was.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deactivateDepartment(supabase: SupabaseClient | any, orgId: string, dept: Department): Promise<void> {
  await supabase.from("department_meta").delete().eq("org_id", orgId).eq("department", dept);
}
