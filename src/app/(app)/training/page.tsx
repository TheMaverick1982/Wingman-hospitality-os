import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { getOrgLocations } from "@/lib/data/locations";
import { getStaffMembers } from "@/lib/data/staff";
import { Pill } from "@/components/ui/pill";
import { TrainingClient, type DeptData, type RoleSummary } from "./training-client";
import { SignoffLog } from "./signoff-log";
import { StartTrainingButton } from "./start-training-button";
import { RoleManager } from "../role-manager";

// AI generation/refinement server actions run from this route; give them room
// to finish instead of hitting the platform's short default function timeout
// (which surfaces as "Unexpected end of JSON input" in the browser).
export const maxDuration = 60;

export default async function TrainingPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const canEdit = canEditSection(profile.accessRole, "training", profile.permissionOverrides);

  const supabase = await createClient();
  const [
    { data: standards },
    { data: trainingItems },
    { data: meta },
    { data: menuItems },
    { data: signoffs },
    locations,
    staff,
  ] = await Promise.all([
    supabase.from("department_standards").select("id, department, item, sort_order, source").order("sort_order"),
    supabase.from("department_training_items").select("id, department, item, sort_order, source").order("sort_order"),
    supabase.from("department_meta").select("department, track_label, has_menu"),
    supabase
      .from("menu_items")
      .select("id, department, name, description, price, allergens, pairing_suggestion, upsell_suggestion, source, popularity_pct, profit_amount")
      .order("sort_order"),
    supabase
      .from("training_signoffs")
      .select("id, staff_name, department, completion_pct, occurred_on")
      .order("occurred_on", { ascending: false }),
    getOrgLocations(),
    getStaffMembers(null),
  ]);

  // The roles this restaurant runs = the ones with a department_meta row (set in
  // the wizard, managed here). Show only those; fall back to all if none exist.
  const activeDepts = ALL_DEPARTMENTS.filter((d) => (meta ?? []).some((m) => m.department === d));
  const inactiveDepts = ALL_DEPARTMENTS.filter((d) => !activeDepts.includes(d));
  const renderDepts = activeDepts.length ? activeDepts : [...ALL_DEPARTMENTS];

  const allSignoffs = signoffs ?? [];
  const data = {} as Record<Department, DeptData>;
  const summaries = {} as Record<Department, RoleSummary>;
  for (const d of renderDepts) {
    const metaRow = meta?.find((m) => m.department === d);
    data[d] = {
      standards: (standards ?? []).filter((s) => s.department === d).map((s) => ({ id: s.id, item: s.item, source: s.source })),
      trainingItems: (trainingItems ?? []).filter((t) => t.department === d).map((t) => ({ id: t.id, item: t.item, source: t.source })),
      trackLabel: metaRow?.track_label ?? null,
      hasMenu: metaRow?.has_menu ?? false,
      menuItems: (menuItems ?? []).filter((m) => m.department === d),
    };

    const deptSignoffs = allSignoffs.filter((s) => s.department === d);
    const people = new Set(deptSignoffs.map((s) => s.staff_name)).size;
    const pct =
      deptSignoffs.length > 0
        ? Math.round(deptSignoffs.reduce((sum, s) => sum + s.completion_pct, 0) / deptSignoffs.length)
        : 0;
    summaries[d] = {
      people,
      pct,
      signoffCount: deptSignoffs.length,
      standardsCount: data[d].standards.length + data[d].trainingItems.length,
    };
  }

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Training & standards</h1>
          <p className="text-base text-muted max-w-xl">
            Department-by-department progress toward your standard, with a real sign-off log.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href="/print/training" target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
            Print / PDF
          </a>
          {!canEdit && <Pill>View only</Pill>}
          {canEdit && <StartTrainingButton staff={staff} locations={locations} departments={renderDepts as Department[]} />}
        </div>
      </div>

      <RoleManager active={activeDepts} inactive={inactiveDepts} canManage={canEdit} />

      <TrainingClient data={data} summaries={summaries} departments={renderDepts} isGm={canEdit} staff={staff} locations={locations} />

      <SignoffLog signoffs={allSignoffs} />
    </>
  );
}
