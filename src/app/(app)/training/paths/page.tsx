import Link from "next/link";
import { redirect } from "next/navigation";
import { Route, ArrowRight, Users } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isManagerOrAbove } from "@/lib/auth/permissions";
import { getPathsForOrg, getStaffPaths } from "@/lib/learning-paths";
import { CreatePathForm } from "./paths-client";
import { StaffPaths } from "./staff-paths";

export const metadata = { title: "Learning paths — Wingman" };

export default async function PathsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/dashboard");
  const canManage = isManagerOrAbove(profile.accessRole);

  const [paths, myPaths] = await Promise.all([
    canManage ? getPathsForOrg(profile.orgId) : Promise.resolve([]),
    getStaffPaths(profile.userId),
  ]);
  const active = paths.filter((p) => !p.archived);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link href="/training" className="text-brick font-semibold text-sm">← Training &amp; standards</Link>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-ink text-white flex items-center justify-center shrink-0 mt-0.5"><Route size={20} /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Learning paths</h1>
          <p className="text-sm text-muted mt-1 max-w-xl">A step-by-step path for a new hire, bundling your tests, role training, and simple tasks into one ordered checklist.</p>
        </div>
      </div>

      {myPaths.length > 0 && (
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-1">Your paths</div>
          <p className="text-[13px] text-muted mb-2">Work through each step in order. Tap a step&rsquo;s <span className="font-semibold">Open</span> link to do it, then check it off. Your progress bar fills as you go.</p>
          <StaffPaths paths={myPaths.map((p) => ({ assignmentId: p.assignmentId, title: p.title, description: p.description, steps: p.steps.map((s) => ({ id: s.id, kind: s.kind, testId: s.testId, department: s.department, title: s.title, detail: s.detail })), completed: [...p.completedStepIds] }))} />
        </div>
      )}

      {canManage && (
        <>
          <div className="bg-brick-tint/40 border border-brick/20 rounded-2xl p-5">
            <div className="text-[14px] font-semibold text-ink mb-2">How to build a path</div>
            <ol className="list-decimal pl-5 flex flex-col gap-1.5 text-[13.5px] text-charcoal-2">
              <li><span className="font-semibold text-ink">Name it</span> for the role and window, like &ldquo;New Server &mdash; First 2 Weeks.&rdquo;</li>
              <li><span className="font-semibold text-ink">Add steps in order.</span> Each step is one of three things: a <span className="font-semibold">Test</span> you&rsquo;ve already built, a role&rsquo;s <span className="font-semibold">Role training</span>, or a simple <span className="font-semibold">Task</span> you type in (for example, &ldquo;Shadow a senior server for one shift&rdquo;). Add a note to any step for extra instructions.</li>
              <li><span className="font-semibold text-ink">Assign it</span> to your new hire(s). They&rsquo;ll see it here when they log in, work through it top to bottom, and check each step off &mdash; and you&rsquo;ll see how far along each person is.</li>
            </ol>
            <p className="text-[12.5px] text-muted-2 mt-3">Reuse the same path for every new hire in that role so everyone gets the exact same start. Need a test first? Build one under &ldquo;Build &amp; manage tests,&rdquo; then add it here as a step.</p>
          </div>
          <CreatePathForm />
          <div className="flex flex-col gap-3">
            <div className="text-[13px] font-semibold uppercase tracking-[0.05em] text-muted-2">All paths</div>
            {active.length === 0 ? (
              <div className="bg-white border border-line rounded-2xl p-6 text-sm text-muted-2">No paths yet. Create one above to get a new hire started.</div>
            ) : (
              active.map((p) => (
                <Link key={p.id} href={`/training/paths/${p.id}`} className="bg-white border border-line rounded-2xl px-5 py-4 shadow-sm flex items-center justify-between gap-3 hover:border-brick transition-colors group">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-ink truncate">{p.title}</div>
                    <div className="text-[12.5px] text-muted-2 flex items-center gap-3 mt-0.5">
                      <span>{p.stepCount} step{p.stepCount === 1 ? "" : "s"}</span>
                      <span className="inline-flex items-center gap-1"><Users size={12} /> {p.assignedCount} assigned</span>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-muted-2 group-hover:text-brick transition-colors shrink-0" />
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
