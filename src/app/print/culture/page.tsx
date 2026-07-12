import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { PrintShell } from "../print-shell";

type CoreValue = { title: string; description: string };

export default async function PrintCulturePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const [{ data: org }, { data: values }] = await Promise.all([
    supabase.from("organizations").select("philosophy, weekly_focus").single(),
    supabase.from("core_values").select("title, description").order("sort_order", { ascending: true }),
  ]);
  const philosophy = (org as { philosophy: string | null } | null)?.philosophy ?? "";
  const weeklyFocus = (org as { weekly_focus: string | null } | null)?.weekly_focus ?? "";
  const coreValues = (values ?? []) as CoreValue[];

  return (
    <PrintShell title="Our Culture" subtitle="What we stand for, and how we show up every shift." orgName={profile.orgName}>
      {philosophy && (
        <div className="avoid-break bg-paper border border-line rounded-xl p-6 mb-6 text-center">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-2 mb-2">Our promise</div>
          <p className="text-[20px] font-semibold text-ink leading-snug">&ldquo;{philosophy}&rdquo;</p>
        </div>
      )}

      {coreValues.length > 0 && (
        <>
          <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-2 mb-3">Core values</div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {coreValues.map((v, i) => (
              <li key={i} className="avoid-break border border-line rounded-xl p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-brick font-bold text-[15px]">{i + 1}.</span>
                  <span className="text-[16px] font-bold text-ink">{v.title}</span>
                </div>
                {v.description && <p className="text-[13.5px] text-muted mt-1">{v.description}</p>}
              </li>
            ))}
          </ol>
        </>
      )}

      {weeklyFocus && (
        <div className="avoid-break border-2 border-brick/40 rounded-xl p-5 text-center">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-brick mb-1">This week&rsquo;s focus</div>
          <p className="text-[17px] font-semibold text-ink">{weeklyFocus}</p>
        </div>
      )}
    </PrintShell>
  );
}
