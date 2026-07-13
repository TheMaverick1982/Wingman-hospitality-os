import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { getStaffMembers } from "@/lib/data/staff";
import { getSectionAccess, canEditSection } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, RECOMMENDATION_OPTIONS, type Department } from "@/lib/constants";
import { normalizeFormConfig, type CustomAnswer } from "@/lib/application-form";
import { Users, Inbox } from "lucide-react";
import { HiringClient, type HiringTrait } from "./hiring-client";
import { CandidateModalButton, type ScoreTrait } from "./candidate-modal";
import { CandidatesPanel } from "./candidate-scorecards";
import { ApplicantsPanel, type Applicant } from "./applicants-panel";
import { InterviewsPanel } from "./interviews-panel";
import { RoleManager } from "../role-manager";

const RECOMMENDATION_TONE: Record<(typeof RECOMMENDATION_OPTIONS)[number], { fg: string; bg: string }> = {
  "Strong fit": { fg: "text-[#15803D]", bg: "bg-[#E7F6EC]" },
  Fit: { fg: "text-brick-dark", bg: "bg-brick-tint" },
  Unsure: { fg: "text-[#B45309]", bg: "bg-[#FDF3E1]" },
  "Not a fit": { fg: "text-danger", bg: "bg-danger-tint" },
};

const AVATAR_TONES = [
  { bg: "bg-brick-tint", fg: "text-brick-dark" },
  { bg: "bg-[#E7F6EC]", fg: "text-[#15803D]" },
  { bg: "bg-[#FDF3E1]", fg: "text-[#B45309]" },
  { bg: "bg-[#F1F1F1]", fg: "text-charcoal-2" },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

// AI generation/refinement server actions run from this route; give them room
// to finish instead of hitting the platform's short default function timeout.
export const maxDuration = 60;

export default async function HiringPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; scoreDept?: string; app?: string; an?: string; scoreLoc?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "hiring", profile.permissionOverrides) === "none") redirect("/dashboard");
  const isSuperAdmin = profile.accessRole === "super_admin";
  const canEdit = canEditSection(profile.accessRole, "hiring", profile.permissionOverrides);

  const { location, scoreDept, app: prefillAppId, an: prefillName, scoreLoc } = await searchParams;
  const autoOpenDepartment = ALL_DEPARTMENTS.includes(scoreDept as Department) ? (scoreDept as Department) : undefined;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
    allLocations: profile.allLocations,
    accessibleLocationIds: profile.accessibleLocationIds,
  });

  const supabase = await createClient();

  let candidatesQ = supabase.from("candidates").select("*").order("occurred_on", { ascending: false });
  if (effectiveLocation) candidatesQ = candidatesQ.eq("location_id", effectiveLocation);

  // Incoming applications, scoped to the viewed location (plus any not tied to a
  // location) so a store manager sees their own pipeline.
  let applicationsQ = supabase
    .from("job_applications")
    .select("id, name, department, location_id, email, phone, availability, message, resume_path, preferred_visit_at, interview_at, interview_details, status, created_at, custom_answers")
    .order("created_at", { ascending: false });
  if (effectiveLocation) applicationsQ = applicationsQ.or(`location_id.eq.${effectiveLocation},location_id.is.null`);

  const [{ data: coreValues }, { data: hiringTraits }, { data: meta }, { data: candidates }, { data: applications }, locations, staff] = await Promise.all([
    supabase
      .from("core_values")
      .select("title, description, hiring_question, hiring_green_flag, hiring_red_flag")
      .order("sort_order"),
    supabase.from("hiring_traits").select("id, department, title, question, green_flag, red_flag, source").order("sort_order"),
    supabase.from("department_meta").select("department"),
    candidatesQ,
    applicationsQ,
    getOrgLocations(),
    getStaffMembers(null),
  ]);

  // The roles this restaurant runs = the ones with a department_meta row (set in
  // the wizard, managed here). Show only those in the role tabs.
  const activeDepts = ALL_DEPARTMENTS.filter((d) => (meta ?? []).some((m) => m.department === d));
  const inactiveDepts = ALL_DEPARTMENTS.filter((d) => !activeDepts.includes(d));

  const traitsByDept = {} as Record<Department, HiringTrait[]>;
  for (const d of ALL_DEPARTMENTS) {
    traitsByDept[d] = (hiringTraits ?? [])
      .filter((t) => t.department === d)
      .map((t) => ({ id: t.id, title: t.title, question: t.question, green_flag: t.green_flag, red_flag: t.red_flag, source: t.source }));
  }

  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
  const allCandidates = candidates ?? [];

  const allApplications: Applicant[] = ((applications ?? []) as {
    id: string; name: string; department: string; location_id: string | null; email: string; phone: string;
    availability: string; message: string; resume_path: string | null; preferred_visit_at: string | null;
    interview_at: string | null; interview_details: string | null; status: string; created_at: string;
    custom_answers: CustomAnswer[] | null;
  }[]).map((a) => ({
    id: a.id,
    name: a.name,
    department: a.department,
    locationId: a.location_id,
    locationName: a.location_id ? locationName(a.location_id) : "",
    email: a.email,
    phone: a.phone,
    availability: a.availability,
    message: a.message,
    hasResume: Boolean(a.resume_path),
    preferredVisitAt: a.preferred_visit_at,
    interviewAt: a.interview_at,
    interviewDetails: a.interview_details ?? "",
    status: a.status,
    createdAt: a.created_at,
    customAnswers: Array.isArray(a.custom_answers) ? a.custom_answers : [],
  }));
  // Unconfirmed applications stay in "Applications"; a confirmed interview moves
  // the person into the candidates area until they're scored.
  const applicants = allApplications.filter((a) => a.status !== "interviewing" && a.status !== "hired");
  const interviews = allApplications.filter((a) => a.status === "interviewing");

  const { data: hiredStaff } = await supabase.from("staff_members").select("candidate_id").not("candidate_id", "is", null);
  const hiredCandidateIds = new Set((hiredStaff ?? []).map((s) => s.candidate_id));

  // Public application link (no subdomain — a path slug on the main site).
  const { data: orgApply } = await supabase.from("organizations").select("public_slug, applications_cc, logo_url, application_form_config").single();
  const orgApplyRow = orgApply as { public_slug: string | null; applications_cc: string | null; logo_url: string | null; application_form_config: unknown } | null;
  const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
  const applyUrl = orgApplyRow?.public_slug ? `${SITE}/apply/${orgApplyRow.public_slug}` : null;
  const applicationsCc = orgApplyRow?.applications_cc ?? "";
  const orgLogoUrl = orgApplyRow?.logo_url ?? null;
  const formConfig = normalizeFormConfig(orgApplyRow?.application_form_config);

  const latestCandidate = allCandidates[0];
  const latestScorecard =
    latestCandidate && coreValues
      ? coreValues.map((v, i) => ({ title: v.title, score: latestCandidate.scores[i] ?? 0 }))
      : [];

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Hire for your values</h1>
          <p className="text-base text-muted max-w-xl">
            Hospitality is the dominant thread for every department — but a cook and a server need very
            different people. Screen for both.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
          {canEdit && (
            <a
              href="#applications"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2.5 hover:border-brick hover:text-brick transition-colors"
            >
              <Inbox size={15} /> See Applications{applicants.length > 0 ? ` (${applicants.length})` : ""}
            </a>
          )}
          <a
            href="#candidate-scorecards"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2.5 hover:border-brick hover:text-brick transition-colors"
          >
            <Users size={15} /> See candidates{allCandidates.length > 0 ? ` (${allCandidates.length})` : ""}
          </a>
          <CandidateModalButton
            universalTraits={(coreValues ?? []).map((v) => ({
              title: v.title,
              question: v.hiring_question,
              green_flag: v.hiring_green_flag,
              red_flag: v.hiring_red_flag,
            }))}
            traitsByDept={Object.fromEntries(
              Object.entries(traitsByDept).map(([d, traits]) => [
                d,
                traits.map((t) => ({ title: t.title, question: t.question, green_flag: t.green_flag, red_flag: t.red_flag })),
              ])
            ) as Record<Department, ScoreTrait[]>}
            locations={locations}
            staff={staff}
            isGm={isSuperAdmin}
            lockedLocationName={profile.locationName}
            defaultLocationId={scoreLoc || effectiveLocation || profile.locationId}
            defaultDepartment={autoOpenDepartment ?? activeDepts[0] ?? ALL_DEPARTMENTS[1]}
            departments={activeDepts}
            autoOpenDepartment={autoOpenDepartment}
            prefillName={prefillName}
            applicationId={prefillAppId}
          />
        </div>
      </div>

      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-5">Pipeline by recommendation</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {RECOMMENDATION_OPTIONS.map((rec) => {
            const cands = allCandidates.filter((c) => c.recommendation === rec);
            return (
              <div key={rec} className="bg-[#FAFAFA] rounded-[14px] p-4">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[13px] font-semibold text-charcoal-2">{rec}</span>
                  <span className="text-xs font-bold text-muted bg-white px-2.5 py-0.5 rounded-full">{cands.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {cands.slice(0, 3).map((c) => {
                    const avg = c.scores.reduce((a: number, b: number) => a + b, 0) / c.scores.length;
                    const tone = toneFor(c.name);
                    return (
                      <div key={c.id} className="bg-white border border-line rounded-[11px] p-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ${tone.bg} ${tone.fg}`}>
                            {initialsOf(c.name)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-ink truncate">{c.name}</div>
                            <div className="text-[11.5px] text-muted-2">{c.department}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2.5">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${RECOMMENDATION_TONE[c.recommendation as keyof typeof RECOMMENDATION_TONE]?.bg} ${RECOMMENDATION_TONE[c.recommendation as keyof typeof RECOMMENDATION_TONE]?.fg}`}>
                            {avg.toFixed(1)}/5
                          </span>
                          <span className="text-[11.5px] text-muted-2">avg score</span>
                        </div>
                      </div>
                    );
                  })}
                  {cands.length === 0 && <p className="text-xs text-muted-2">None yet.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <RoleManager active={activeDepts} inactive={inactiveDepts} canManage={canEdit} />

      <HiringClient coreValues={coreValues ?? []} traitsByDept={traitsByDept} departments={activeDepts} canEdit={canEdit} />

      <div className="lg:max-w-md">
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Values scorecard</div>
          {latestCandidate ? (
            <>
              <div className="text-[13px] text-muted mb-5">
                {latestCandidate.name} · {latestCandidate.department} candidate
              </div>
              <div className="flex flex-col gap-4">
                {latestScorecard.map((s) => (
                  <div key={s.title}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-sm font-medium text-ink">{s.title}</span>
                      <span className="text-[13px] font-semibold text-muted tabular-nums">{s.score}/5</span>
                    </div>
                    <div className="flex gap-1.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span key={i} className={`flex-1 h-1.5 rounded-full ${i < s.score ? "bg-brick" : "bg-line"}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted mt-2">No candidates scored yet.</p>
          )}
        </div>
      </div>

      {canEdit && (
        <div id="applications" className="scroll-mt-24">
          <ApplicantsPanel applicants={applicants} applyUrl={applyUrl} applicationsCc={applicationsCc} logoUrl={orgLogoUrl} formConfig={formConfig} />
        </div>
      )}

      {canEdit && interviews.length > 0 && <InterviewsPanel interviews={interviews} />}

      <CandidatesPanel
        candidates={allCandidates.map((c) => ({
          id: c.id,
          name: c.name,
          department: c.department,
          locationId: c.location_id,
          locationName: locationName(c.location_id),
          date: c.occurred_on,
          avg: c.scores.length ? c.scores.reduce((a: number, b: number) => a + b, 0) / c.scores.length : 0,
          recommendation: c.recommendation,
          hired: hiredCandidateIds.has(c.id),
        }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        departments={Array.from(new Set([...activeDepts, ...allCandidates.map((c) => c.department as string)]))}
        canEdit={canEdit}
        isSuperAdmin={isSuperAdmin}
      />
    </>
  );
}
