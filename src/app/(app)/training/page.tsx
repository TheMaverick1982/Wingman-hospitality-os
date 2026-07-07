import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { Pill } from "@/components/ui/pill";
import { TrainingClient, type DeptData } from "./training-client";

export default async function TrainingPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const canEdit = canEditSection(profile.accessRole, "training");

  const supabase = await createClient();
  const [
    { data: standards },
    { data: trainingItems },
    { data: meta },
    { data: menus },
    { data: signoffs },
  ] = await Promise.all([
    supabase.from("department_standards").select("department, item, sort_order").order("sort_order"),
    supabase.from("department_training_items").select("department, item, sort_order").order("sort_order"),
    supabase.from("department_meta").select("department, track_label, has_menu"),
    supabase.from("menu_references").select("department, content"),
    supabase
      .from("training_signoffs")
      .select("id, staff_name, department, completion_pct, occurred_on")
      .order("occurred_on", { ascending: false }),
  ]);

  const data = {} as Record<Department, DeptData>;
  for (const d of ALL_DEPARTMENTS) {
    const metaRow = meta?.find((m) => m.department === d);
    data[d] = {
      standards: (standards ?? []).filter((s) => s.department === d).map((s) => s.item),
      trainingItems: (trainingItems ?? []).filter((t) => t.department === d).map((t) => t.item),
      trackLabel: metaRow?.track_label ?? null,
      hasMenu: metaRow?.has_menu ?? false,
      menuContent: menus?.find((m) => m.department === d)?.content ?? "",
    };
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Training & Standards</h1>
          <p className="text-sm text-muted max-w-xl">
            A full program per department. Hospitality is the dominant thread through everything — but
            each department has its own technical ground to cover too.
          </p>
        </div>
        {!canEdit && <Pill>View only</Pill>}
      </div>

      <TrainingClient data={data} isGm={canEdit} />

      <h3 className="font-display text-lg font-semibold mt-8 mb-3 text-ink">Sign-off log</h3>
      <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#fafafa] border-b border-line">
              {["Name", "Department", "Date", "Completion"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(signoffs ?? []).map((t) => (
              <tr key={t.id} className="border-b border-line hover:bg-[#fafafa] transition-colors">
                <td className="px-5 py-3.5 text-ink">{t.staff_name}</td>
                <td className="px-5 py-3.5">
                  <Pill>{t.department}</Pill>
                </td>
                <td className="px-5 py-3.5 text-muted">{t.occurred_on}</td>
                <td className={`px-5 py-3.5 font-mono ${t.completion_pct === 100 ? "text-olive" : "text-gold"}`}>
                  {t.completion_pct}%
                </td>
              </tr>
            ))}
            {(signoffs ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-muted">
                  No sign-offs logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
