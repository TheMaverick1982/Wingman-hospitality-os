import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Pencil } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { ContinuingEdBuilder } from "./continuing-ed-builder";

// AI drafting runs from here — give it room past the default timeout.
export const maxDuration = 60;

export default async function ContinuingEducationPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "training", profile.permissionOverrides) === "none") redirect("/dashboard");
  if (!canEditSection(profile.accessRole, "training", profile.permissionOverrides)) redirect("/training");

  const supabase = await createClient();
  const [{ data: tests }, { data: meta }] = await Promise.all([
    supabase
      .from("tests")
      .select("id, title, target_departments, active")
      .eq("rotates_monthly", true)
      .eq("mode", "study_quiz")
      .order("created_at", { ascending: false }),
    supabase.from("department_meta").select("department"),
  ]);
  const activeDepts = ALL_DEPARTMENTS.filter((d) => (meta ?? []).some((m) => m.department === d));
  const modules = (tests ?? []) as { id: string; title: string; target_departments: string[] | null; active: boolean }[];

  return (
    <>
      <div>
        <Link href="/training" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-2 hover:text-ink mb-3">
          <ArrowLeft size={14} /> Back to Training
        </Link>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#15803d] text-white flex items-center justify-center shrink-0 mt-0.5">
            <CalendarClock size={20} />
          </div>
          <div>
            <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Continuing education</h1>
            <p className="text-base text-muted max-w-2xl">
              Great hospitality is a habit, not a two-day program. Build a short monthly refresher once — Wingman
              re-assigns it to your team as a fresh attempt on the 1st of every month and emails everyone a link. Set a
              core one for <span className="font-semibold text-ink">everyone</span>, plus role-specific ones that only
              reach that department.
            </p>
          </div>
        </div>
      </div>

      {modules.length > 0 && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="text-[15px] font-semibold text-ink mb-3">Running monthly ({modules.length})</div>
          <div className="flex flex-col divide-y divide-line">
            {modules.map((m) => {
              const t = (m.target_departments ?? []).filter(Boolean);
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{m.title}</div>
                    <div className="text-xs text-muted-2">
                      {t.length ? t.join(", ") : "All staff"}
                      {m.active ? "" : " · archived"}
                    </div>
                  </div>
                  <Link
                    href={`/training/tests/${m.id}`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-3.5 py-1.5 hover:border-brick hover:text-brick transition-colors shrink-0"
                  >
                    <Pencil size={13} /> Edit
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ContinuingEdBuilder departments={(activeDepts.length ? activeDepts : [...ALL_DEPARTMENTS]) as Department[]} />
    </>
  );
}
