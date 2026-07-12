import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS } from "@/lib/constants";
import { PrintShell } from "../print-shell";

type Item = { department: string; item: string; sort_order: number };

export default async function PrintTrainingPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const [{ data: standards }, { data: training }] = await Promise.all([
    supabase.from("department_standards").select("department, item, sort_order").order("sort_order"),
    supabase.from("department_training_items").select("department, item, sort_order").order("sort_order"),
  ]);

  const byDept = (rows: Item[] | null, dept: string) => (rows ?? []).filter((r) => r.department === dept);
  const depts = ALL_DEPARTMENTS.filter((d) => byDept(standards as Item[], d).length + byDept(training as Item[], d).length > 0);

  return (
    <PrintShell title="Training & Standards" subtitle="The standards and skills every role holds." orgName={profile.orgName}>
      {depts.length === 0 ? (
        <p className="text-[14px] text-muted">No training built yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {depts.map((dept) => {
            const std = byDept(standards as Item[], dept);
            const skills = byDept(training as Item[], dept);
            return (
              <section key={dept} className="avoid-break">
                <h2 className="text-[19px] font-bold text-ink border-b border-line pb-1.5 mb-2.5">{dept}</h2>
                {std.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-olive mb-1.5">Hospitality standards</div>
                    <ul className="flex flex-col gap-1">
                      {std.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13.5px] text-ink">
                          <span className="mt-1 inline-block w-3.5 h-3.5 border border-charcoal-2 rounded-[3px] shrink-0" />
                          <span>{s.item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {skills.length > 0 && (
                  <div>
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-2 mb-1.5">Role skills</div>
                    <ul className="flex flex-col gap-1">
                      {skills.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13.5px] text-ink">
                          <span className="mt-1 inline-block w-3.5 h-3.5 border border-charcoal-2 rounded-[3px] shrink-0" />
                          <span>{s.item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </PrintShell>
  );
}
