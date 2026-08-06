import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake, ClipboardCheck, ArrowLeft, Eye } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { resolveMyStaff } from "@/lib/data/my-staff";
import { getActiveDepartments } from "@/lib/roles";
import { canEditSection } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { RoleOverviewEditor } from "./role-overview-editor";

export const metadata: Metadata = { title: "Your role" };

// Staff-facing role guide: the standard a person is held to (guest-experience
// behaviors) and what they own (role duties). Reads the same per-role content
// managers author on Training (department_standards + department_training_items),
// keyed by department. Staff see their own role; managers/owners can preview any
// active role's guide via ?department= (a role-switcher lets them flip through).
export default async function MyRolePage({ searchParams }: { searchParams: Promise<{ department?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const { department: deptParam } = await searchParams;

  // Managers/owners can preview any role's guide (oversight + "what staff see").
  const canPreview =
    canEditSection(profile.accessRole, "training", profile.permissionOverrides) ||
    canEditSection(profile.accessRole, "staff", profile.permissionOverrides);
  const activeDepts = canPreview ? await getActiveDepartments() : [];
  const validParam = deptParam && (ALL_DEPARTMENTS as readonly string[]).includes(deptParam) && activeDepts.includes(deptParam as Department);

  let department: string | null = null;
  let previewMode = false;
  if (canPreview && validParam) {
    department = deptParam!;
    previewMode = true;
  } else {
    const myStaff = await resolveMyStaff(profile);
    if (myStaff) {
      department = myStaff.department;
    } else if (canPreview && activeDepts.length > 0) {
      // A manager without a staff record lands in preview mode on the first role.
      department = activeDepts[0];
      previewMode = true;
    }
  }

  if (!department) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink mb-1.5">Your role</h1>
        <div className="bg-white border border-line rounded-2xl p-8 shadow-sm text-center mt-4">
          <p className="text-[15px] text-ink font-semibold">Your login isn&rsquo;t linked to your staff profile yet.</p>
          <p className="text-sm text-muted mt-1.5 max-w-md mx-auto">
            Ask a manager to connect your account on the Staff page — then your role guide will show up here.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: standardRows }, { data: dutyRows }] = await Promise.all([
    supabase.from("department_standards").select("item").eq("department", department).order("sort_order"),
    supabase.from("department_training_items").select("item").eq("department", department).order("sort_order"),
  ]);
  const behaviors = ((standardRows ?? []) as { item: string }[]).map((r) => r.item).filter(Boolean);
  const duties = ((dutyRows ?? []) as { item: string }[]).map((r) => r.item).filter(Boolean);

  // department_meta.description is added by migration 0146. Read it guarded so a
  // not-yet-applied migration (or a lagging migrate job) can never break the
  // guide — fall back to just the track label if the column isn't there yet.
  let trackLabel: string | null = null;
  let description: string | null = null;
  const metaFull = await supabase.from("department_meta").select("track_label, description").eq("department", department).maybeSingle();
  if (metaFull.error) {
    const metaBase = await supabase.from("department_meta").select("track_label").eq("department", department).maybeSingle();
    trackLabel = (metaBase.data as { track_label?: string | null } | null)?.track_label ?? null;
  } else {
    const m = metaFull.data as { track_label?: string | null; description?: string | null } | null;
    trackLabel = m?.track_label ?? null;
    description = m?.description?.trim() || null;
  }
  const nothingYet = behaviors.length === 0 && duties.length === 0;

  // Owner's Mindset (the culture core) — shown at the top of every role guide so
  // it's in front of the team every shift. Guarded: owner_mindset lands with
  // migration 0151, and a missing column degrades to "not shown".
  let ownerMindset: string | null = null;
  {
    const { data: orgRow } = await supabase.from("organizations").select("owner_mindset").maybeSingle();
    ownerMindset = ((orgRow as { owner_mindset?: string | null } | null)?.owner_mindset ?? "").trim() || null;
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={previewMode ? "/training" : "/dashboard"}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-2 hover:text-ink mb-4"
      >
        <ArrowLeft size={15} /> {previewMode ? "Training & standards" : "Dashboard"}
      </Link>

      {previewMode && (
        <div className="mb-5 rounded-2xl border border-brick/25 bg-brick-tint/50 px-5 py-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-brick mb-3">
            <Eye size={15} /> Preview — this is exactly what a team member in this role sees. Edit it in Training &amp; Standards.
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeDepts.map((d) => (
              <Link
                key={d}
                href={`/my-role?department=${encodeURIComponent(d)}`}
                className={`text-[12.5px] font-semibold rounded-full px-3 py-1 border transition-colors ${
                  d === department ? "border-brick text-white bg-brick" : "border-line text-charcoal-2 bg-white hover:border-brick"
                }`}
              >
                {d}
              </Link>
            ))}
          </div>
        </div>
      )}

      <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] leading-[1.12] text-ink mb-1">
        {previewMode ? `${department} — role guide` : `Your role: ${department}`}
      </h1>
      {trackLabel && (
        <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-4">{trackLabel}</p>
      )}

      {previewMode ? (
        <RoleOverviewEditor department={department} initial={description ?? ""} />
      ) : description ? (
        <p className="text-[16px] leading-[1.6] text-charcoal-2 mb-6">{description}</p>
      ) : (
        <p className="text-base text-muted mb-6">
          What great looks like in your role — the standard you&rsquo;re held to, and what we count on you for.
        </p>
      )}

      {ownerMindset && (
        <div className="mb-6 rounded-2xl bg-[#0A0A0A] text-white p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4D97FF] mb-2.5">How we run this place</div>
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-white/90">{ownerMindset}</div>
        </div>
      )}

      {nothingYet ? (
        <div className="bg-white border border-line rounded-2xl p-8 shadow-sm text-center">
          <p className="text-[15px] text-ink font-semibold">{previewMode ? "This role guide is empty." : "Your role guide is being set up."}</p>
          <p className="text-sm text-muted mt-1.5 max-w-md mx-auto">
            {previewMode
              ? `Add ${department} standards and duties in Training & Standards and they'll show up here.`
              : `Your manager is still adding what's expected for the ${department} role. Check back soon — it'll show up right here.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <RoleSection
            icon={<HeartHandshake size={18} className="text-brick" />}
            title="Guest experience — how we make people feel"
            blurb="The hospitality standard for this role. This is what every guest should feel."
            items={behaviors}
            emptyLabel="No guest-experience standards added yet for this role."
          />
          <RoleSection
            icon={<ClipboardCheck size={18} className="text-brick" />}
            title="Responsibilities — what you own"
            blurb="The tasks and duties counted on, every shift."
            items={duties}
            emptyLabel="No responsibilities added yet for this role."
          />
        </div>
      )}
    </div>
  );
}

function RoleSection({
  icon,
  title,
  blurb,
  items,
  emptyLabel,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <details open className="group bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
      <summary className="flex items-center gap-3 px-6 py-4 cursor-pointer list-none select-none">
        <span className="w-9 h-9 rounded-[11px] bg-brick-tint flex items-center justify-center shrink-0">{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-semibold text-ink">{title}</span>
          <span className="block text-[13px] text-muted-2">{blurb}</span>
        </span>
        <span className="shrink-0 text-muted-2 text-[13px] tabular-nums transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="px-6 pb-5 pt-1 border-t border-[#F5F5F5]">
        {items.length > 0 ? (
          <ul className="flex flex-col gap-2.5 mt-3">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14.5px] leading-[1.5] text-charcoal-2">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-brick shrink-0" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted mt-3">{emptyLabel}</p>
        )}
      </div>
    </details>
  );
}
