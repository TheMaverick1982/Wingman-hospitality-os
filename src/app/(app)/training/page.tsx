import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { Pill } from "@/components/ui/pill";
import { TrainingClient, type DeptData, type RoleSummary } from "./training-client";
import { SignoffLog } from "./signoff-log";

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
  ] = await Promise.all([
    supabase.from("department_standards").select("department, item, sort_order").order("sort_order"),
    supabase.from("department_training_items").select("department, item, sort_order").order("sort_order"),
    supabase.from("department_meta").select("department, track_label, has_menu"),
    supabase
      .from("menu_items")
      .select("id, department, name, description, price, allergens, pairing_suggestion, upsell_suggestion, source, popularity_pct, profit_amount")
      .order("sort_order"),
    supabase
      .from("training_signoffs")
      .select("id, staff_name, department, completion_pct, occurred_on")
      .order("occurred_on", { ascending: false }),
  ]);

  const allSignoffs = signoffs ?? [];
  const data = {} as Record<Department, DeptData>;
  const summaries = {} as Record<Department, RoleSummary>;
  for (const d of ALL_DEPARTMENTS) {
    const metaRow = meta?.find((m) => m.department === d);
    data[d] = {
      standards: (standards ?? []).filter((s) => s.department === d).map((s) => s.item),
      trainingItems: (trainingItems ?? []).filter((t) => t.department === d).map((t) => t.item),
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
        {!canEdit && <Pill>View only</Pill>}
      </div>

      <TrainingClient data={data} summaries={summaries} isGm={canEdit} />

      <SignoffLog signoffs={allSignoffs} />
    </>
  );
}
