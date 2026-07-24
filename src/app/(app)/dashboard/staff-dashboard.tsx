import Link from "next/link";
import { ClipboardList, Sparkle, ArrowRight, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StaffTests } from "@/components/dashboard/staff-tests";
import { getStaffTests, isTestToDo } from "@/lib/data/staff-tests";
import { resolveMyStaff } from "@/lib/data/my-staff";
import type { CurrentProfile } from "@/lib/auth/profile";

// Personal dashboard for the staff role — their own tests to take, training,
// checklist, and this week's focus, instead of the restaurant-wide manager view.
export async function StaffDashboard({ profile }: { profile: CurrentProfile }) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const firstName = profile.fullName.split(" ")[0] || "there";

  const myStaff = await resolveMyStaff(profile);

  if (!myStaff) {
    return (
      <>
        <StaffGreeting firstName={firstName} />
        <div className="bg-white border border-line rounded-2xl p-8 shadow-sm text-center">
          <p className="text-[15px] text-ink font-semibold">Your login isn&rsquo;t linked to your staff profile yet.</p>
          <p className="text-sm text-muted mt-1.5 max-w-md mx-auto">
            Ask a manager to connect your account on the Staff page — then your training and tests will show up here.
          </p>
        </div>
      </>
    );
  }
  const staffId = myStaff.id;
  const department = myStaff.department;

  const [{ data: org }, { data: standards }, { data: trainingItems }, { data: progress }, tests] = await Promise.all([
    supabase.from("organizations").select("weekly_focus, weekly_experiment").single(),
    supabase.from("department_standards").select("id").eq("department", department),
    supabase.from("department_training_items").select("id").eq("department", department),
    admin.from("staff_training_progress").select("item_type, item_id, checked").eq("staff_id", staffId),
    getStaffTests(staffId),
  ]);

  const weeklyFocus = (org as { weekly_focus?: string | null } | null)?.weekly_focus || "";
  const weeklyExperiment = (org as { weekly_experiment?: string | null } | null)?.weekly_experiment || "";

  // "Your training %": how many of your department's standards + training items
  // are checked off.
  const checkedKeys = new Set(
    ((progress ?? []) as { item_type: string; item_id: string; checked: boolean }[])
      .filter((p) => p.checked)
      .map((p) => `${p.item_type}:${p.item_id}`)
  );
  const allItemKeys = [
    ...((standards ?? []) as { id: string }[]).map((s) => `standard:${s.id}`),
    ...((trainingItems ?? []) as { id: string }[]).map((t) => `training:${t.id}`),
  ];
  const trainingPct =
    allItemKeys.length > 0
      ? Math.round((allItemKeys.filter((k) => checkedKeys.has(k)).length / allItemKeys.length) * 100)
      : 0;

  // The dashboard shows only what still needs doing; full history lives on Training.
  const toDo = tests.filter(isTestToDo);
  const passedCount = tests.filter((t) => t.status === "passed").length;

  return (
    <>
      <StaffGreeting firstName={firstName} />

      {(weeklyFocus || weeklyExperiment) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {weeklyFocus && (
            <div className="flex items-start gap-3 bg-gold-tint rounded-2xl px-5 py-4">
              <Sparkle size={16} className="text-[#b45309] shrink-0 mt-0.5" />
              <span className="text-sm text-[#b45309]">
                <span className="font-semibold">This week&rsquo;s focus:</span> {weeklyFocus}
              </span>
            </div>
          )}
          {weeklyExperiment && (
            <div className="flex items-start gap-3 bg-gold-tint rounded-2xl px-5 py-4">
              <Sparkle size={16} className="text-[#b45309] shrink-0 mt-0.5" />
              <span className="text-sm text-[#b45309]">
                <span className="font-semibold">This week&rsquo;s experiment:</span> {weeklyExperiment}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KpiCard label="Training complete" value={`${trainingPct}%`} sub="of your role's standards" />
        <KpiCard label="Tests to take" value={String(toDo.length)} sub="assigned to you" />
        <KpiCard label="Tests passed" value={String(passedCount)} sub="nice work" />
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 pt-1">Tests to take</div>
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <StaffTests tests={toDo} emptyLabel="No tests to take — you're all caught up. See your results on Training." />
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2 pt-1">Your day</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Link
          href="/accountability"
          className="flex items-center gap-4 bg-white border border-line rounded-2xl p-6 shadow-sm hover:border-brick transition-colors group"
        >
          <span className="w-11 h-11 rounded-[12px] bg-brick-tint text-brick flex items-center justify-center shrink-0">
            <ListChecks size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink">Your pre-shift checklist</div>
            <div className="text-[13px] text-muted-2">Run through today&rsquo;s checklist before your shift.</div>
          </div>
          <ArrowRight size={17} className="text-muted-2 shrink-0 group-hover:text-brick transition-colors" />
        </Link>

        <Link
          href="/training"
          className="flex items-center gap-4 bg-white border border-line rounded-2xl p-6 shadow-sm hover:border-brick transition-colors group"
        >
          <span className="w-11 h-11 rounded-[12px] bg-brick-tint text-brick flex items-center justify-center shrink-0">
            <ClipboardList size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink">Your training & results</div>
            <div className="text-[13px] text-muted-2">Your standards, past tests, and scores.</div>
          </div>
          <ArrowRight size={17} className="text-muted-2 shrink-0 group-hover:text-brick transition-colors" />
        </Link>
      </div>
    </>
  );
}

function StaffGreeting({ firstName }: { firstName: string }) {
  return (
    <div>
      <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] leading-[1.12] text-ink mb-1.5 text-balance">
        Hi {firstName}
      </h1>
      <p className="text-base text-muted">Your training, tests, and today&rsquo;s focus — all in one place.</p>
    </div>
  );
}
