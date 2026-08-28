import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { getStaffMembers } from "@/lib/data/staff";
import { getSectionAccess, canEditSection } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, OPENING_OTHER_ROLE, type Department } from "@/lib/constants";
import { normalizeFormConfig, type CustomAnswer } from "@/lib/application-form";
import { TIER_META, type ScreeningGrade, type ScreeningAnswer, type ScreeningQuestion } from "@/lib/screening";
import { ScreeningQuestionsPanel, type ScreeningRole } from "./screening-questions-panel";
import { Users, Inbox } from "lucide-react";
import { HiringClient, type HiringTrait } from "./hiring-client";
import { CandidateModalButton, type ScoreTrait } from "./candidate-modal";
import { CandidatesPanel } from "./candidate-scorecards";
import { ApplicantsPanel, type Applicant } from "./applicants-panel";
import { OpeningsPanel, type OpeningRow } from "./openings-panel";
import { InterviewsPanel } from "./interviews-panel";
import { RoleManager } from "../role-manager";
import { ScrollToButton } from "./scroll-to-button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

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
  // Candidates + applications are read with the service-role client scoped to
  // this org. The page has already authorized the viewer for Hiring
  // (getSectionAccess above), but the job_applications/candidates RLS gates reads
  // behind is_manager_or_above() — a PER-ORG role — so a platform admin (or any
  // hiring-authorized user who isn't a manager in this specific org) would see the
  // page yet get zero applications. Reading own-org hiring data by org_id here
  // keeps everyone who's allowed on the page seeing the same data. Never widen
  // beyond profile.orgId.
  const hiringAdmin = createAdminClient();

  let candidatesQ = hiringAdmin.from("candidates").select("*").eq("org_id", profile.orgId).order("occurred_on", { ascending: false });
  if (effectiveLocation) candidatesQ = candidatesQ.eq("location_id", effectiveLocation);

  // Applications follow the same location logic as everything else on the page:
  // the top-bar location selector scopes the intake. Pick a location and you see
  // that location's applicants; pick "All locations" (only spanning owners/
  // all-locations managers can) and you see every application.
  //
  // Safety net for members who CAN'T switch to an all-locations view (a
  // location-locked or specific-locations member): they always keep unassigned
  // (no-location) intake so an applicant who didn't pick a store is never lost.
  // A spanning admin sees those unassigned applications under "All locations".
  //
  // Only 0084 base columns are selected here. interview_at / interview_details are
  // added by migration 0087 and are read separately in a guarded query below, so a
  // not-yet-applied migration degrades to "no interview info" instead of erroring
  // this whole query and blanking the applicants list — the same defensive pattern
  // used for custom_answers / screening / form config throughout this page.
  let applicationsQ = hiringAdmin
    .from("job_applications")
    .select("id, name, department, location_id, email, phone, availability, message, resume_path, preferred_visit_at, status, created_at, source")
    .eq("org_id", profile.orgId)
    .order("created_at", { ascending: false });
  const spansAllLocations = profile.accessRole === "super_admin" || profile.allLocations;
  if (effectiveLocation) {
    applicationsQ = spansAllLocations
      ? applicationsQ.eq("location_id", effectiveLocation)
      : applicationsQ.or(`location_id.eq.${effectiveLocation},location_id.is.null`);
  } else if (!spansAllLocations) {
    const reachable = [profile.locationId, ...profile.accessibleLocationIds].filter(Boolean) as string[];
    const clauses = [...reachable.map((id) => `location_id.eq.${id}`), "location_id.is.null"];
    applicationsQ = applicationsQ.or(clauses.join(","));
  }

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
  // The zone to read a location's interview/visit times in. Falls back to the
  // viewer's home-location zone for unassigned (no-location) applications.
  const locationTz = (id: string | null) =>
    (id ? locations.find((l) => l.id === id)?.timezone : null) ?? profile.locationTimezone ?? null;
  const allCandidates = candidates ?? [];

  // Custom answers live in a column added by a later migration. Read them in an
  // isolated, guarded query so a not-yet-applied migration degrades to "no custom
  // answers" instead of breaking the whole applicants list.
  const customAnswersById = new Map<string, CustomAnswer[]>();
  {
    const { data: caRows } = await hiringAdmin.from("job_applications").select("id, custom_answers").eq("org_id", profile.orgId);
    for (const r of (caRows ?? []) as { id: string; custom_answers: CustomAnswer[] | null }[]) {
      if (Array.isArray(r.custom_answers) && r.custom_answers.length) customAnswersById.set(r.id, r.custom_answers);
    }
  }

  // Rejection note + do-not-hire flag land with migration 0167. Read them in an
  // isolated guarded query so a not-yet-applied migration degrades to "no
  // rejection details" instead of breaking the whole applications list.
  const rejectionById = new Map<string, { note: string; doNotHire: boolean }>();
  {
    const { data: rjRows } = await hiringAdmin.from("job_applications").select("id, rejection_note, do_not_hire").eq("org_id", profile.orgId);
    for (const r of (rjRows ?? []) as { id: string; rejection_note: string | null; do_not_hire: boolean | null }[]) {
      rejectionById.set(r.id, { note: r.rejection_note ?? "", doNotHire: Boolean(r.do_not_hire) });
    }
  }

  // Interview scheduling columns land with migration 0087. Read them in isolation
  // so a not-yet-applied migration degrades to "no interview scheduled" instead of
  // erroring the applications query and blanking the whole list.
  const interviewById = new Map<string, { at: string | null; details: string }>();
  {
    const { data: ivRows } = await hiringAdmin.from("job_applications").select("id, interview_at, interview_details").eq("org_id", profile.orgId);
    for (const r of (ivRows ?? []) as { id: string; interview_at: string | null; interview_details: string | null }[]) {
      interviewById.set(r.id, { at: r.interview_at ?? null, details: r.interview_details ?? "" });
    }
  }

  // Screening answers + AI grade live in columns added by a later migration. Read
  // them in an isolated, guarded query so a not-yet-applied migration degrades to
  // "no screening" instead of breaking the whole applicants list.
  const screeningById = new Map<string, { grade: ScreeningGrade | null; answers: ScreeningAnswer[] }>();
  {
    const { data: sgRows } = await hiringAdmin.from("job_applications").select("id, screening_grade, screening_answers").eq("org_id", profile.orgId);
    for (const r of (sgRows ?? []) as { id: string; screening_grade: ScreeningGrade | null; screening_answers: ScreeningAnswer[] | null }[]) {
      screeningById.set(r.id, { grade: r.screening_grade ?? null, answers: Array.isArray(r.screening_answers) ? r.screening_answers : [] });
    }
  }

  // Custom job roles this org has posted (openings under the "Other" bucket carry
  // the role name in their title). These get their own screening tabs alongside
  // the standard roles. Unfiltered by location — screening is org-wide.
  const customRoleNames: string[] = [];
  {
    const { data: crRows } = await supabase
      .from("job_openings")
      .select("title")
      .eq("org_id", profile.orgId)
      .eq("department", OPENING_OTHER_ROLE);
    const seen = new Set<string>();
    for (const r of (crRows ?? []) as { title: string | null }[]) {
      const name = r.title?.trim();
      if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); customRoleNames.push(name); }
    }
    customRoleNames.sort((a, b) => a.localeCompare(b));
  }

  // The key a screening row belongs to: standard role → department; custom role →
  // "other:<name>". Must match the keys built for the panel's `roles` below.
  const screeningRoleKey = (department: string, customRole: string | null) =>
    customRole?.trim() ? `other:${customRole.trim().toLowerCase()}` : department;

  // Per-role screening questions for the authoring panel (guarded — the table
  // lands with a migration, so this degrades to "none" until then).
  const screeningQuestionsByRole: Record<string, ScreeningQuestion[]> = {};
  {
    const { data: sqRows } = await supabase
      .from("screening_questions")
      .select("id, department, custom_role, prompt, axis, sort_order, source, required")
      .order("sort_order");
    for (const r of (sqRows ?? []) as (ScreeningQuestion & { custom_role: string | null })[]) {
      (screeningQuestionsByRole[screeningRoleKey(r.department, r.custom_role)] ??= []).push(r);
    }
  }

  // Standard roles first, then custom roles as their own tabs.
  const screeningRoles: ScreeningRole[] = [
    ...activeDepts.map((d) => ({ key: d, label: d, department: d, customRole: null as string | null })),
    ...customRoleNames.map((name) => ({ key: `other:${name.toLowerCase()}`, label: name, department: OPENING_OTHER_ROLE, customRole: name })),
  ];

  const allApplications: Applicant[] = ((applications ?? []) as {
    id: string; name: string; department: string; location_id: string | null; email: string; phone: string;
    availability: string; message: string; resume_path: string | null; preferred_visit_at: string | null;
    status: string; created_at: string; source: string | null;
  }[]).map((a) => ({
    id: a.id,
    name: a.name,
    department: a.department,
    locationId: a.location_id,
    locationName: a.location_id ? locationName(a.location_id) : "",
    locationTimezone: locationTz(a.location_id),
    email: a.email,
    phone: a.phone,
    availability: a.availability,
    message: a.message,
    hasResume: Boolean(a.resume_path),
    source: a.source || "link",
    rejectionNote: rejectionById.get(a.id)?.note ?? "",
    doNotHire: rejectionById.get(a.id)?.doNotHire ?? false,
    preferredVisitAt: a.preferred_visit_at,
    interviewAt: interviewById.get(a.id)?.at ?? null,
    interviewDetails: interviewById.get(a.id)?.details ?? "",
    status: a.status,
    createdAt: a.created_at,
    customAnswers: customAnswersById.get(a.id) ?? [],
    screeningGrade: screeningById.get(a.id)?.grade ?? null,
    screeningAnswers: screeningById.get(a.id)?.answers ?? [],
  }));
  // Unconfirmed applications stay in "Applications"; a confirmed interview moves
  // the person into the candidates area until they're scored.
  const applicants = allApplications.filter((a) => a.status !== "interviewing" && a.status !== "hired");
  const interviews = allApplications.filter((a) => a.status === "interviewing");

  // Inbound applications by AI screening fit — the top-of-page read on lead
  // quality, pulled from the applications' own screening tiers.
  const activeApplicants = applicants.filter((a) => a.status !== "not_a_fit");
  const fitTiles = [
    { key: "strong", label: TIER_META.strong.label, fg: TIER_META.strong.fg, bg: TIER_META.strong.bg, n: activeApplicants.filter((a) => a.screeningGrade?.tier === "strong").length },
    { key: "worth_a_look", label: TIER_META.worth_a_look.label, fg: TIER_META.worth_a_look.fg, bg: TIER_META.worth_a_look.bg, n: activeApplicants.filter((a) => a.screeningGrade?.tier === "worth_a_look").length },
    { key: "pass", label: TIER_META.pass.label, fg: TIER_META.pass.fg, bg: TIER_META.pass.bg, n: activeApplicants.filter((a) => a.screeningGrade?.tier === "pass").length },
    { key: "unscored", label: "Not yet screened", fg: "text-charcoal-2", bg: "bg-[#F1F1F1]", n: activeApplicants.filter((a) => !a.screeningGrade).length },
  ];

  const { data: hiredStaff } = await hiringAdmin.from("staff_members").select("candidate_id").eq("org_id", profile.orgId).not("candidate_id", "is", null);
  const hiredCandidateIds = new Set((hiredStaff ?? []).map((s) => s.candidate_id));

  // Public application link (no subdomain — a path slug on the main site).
  // These columns all pre-date the form-builder, so read them in the main query.
  const { data: orgApply } = await supabase.from("organizations").select("public_slug, applications_cc, logo_url").single();
  const orgApplyRow = orgApply as { public_slug: string | null; applications_cc: string | null; logo_url: string | null } | null;
  const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
  const applyUrl = orgApplyRow?.public_slug ? `${SITE}/apply/${orgApplyRow.public_slug}` : null;
  const careersUrl = orgApplyRow?.public_slug ? `${SITE}/careers/${orgApplyRow.public_slug}` : null;
  const applicationsCc = orgApplyRow?.applications_cc ?? "";
  const orgLogoUrl = orgApplyRow?.logo_url ?? null;
  // application_form_config is added by a later migration — read it in isolation so
  // a not-yet-applied migration can never take down the logo, apply link, or panel.
  let formConfig = normalizeFormConfig(null);
  {
    const { data: cfgRow } = await supabase.from("organizations").select("application_form_config").single();
    if (cfgRow) formConfig = normalizeFormConfig((cfgRow as { application_form_config: unknown }).application_form_config);
  }

  // Job openings (the job_openings table + job_applications.opening_id land with
  // migration 0147 — every read here is guarded so a not-yet-applied migration can
  // never take down the hiring page).
  const openings: OpeningRow[] = [];
  const openingCounts: Record<string, number> = {};
  let openingLocations: { id: string; name: string }[] = [];
  if (canEdit) {
    // Scope openings to the selected location, same as the rest of the page. An
    // opening posted for "All locations" (location_id null) is recruiting at every
    // store, so it stays visible in a single-location view too.
    //
    // Critically, job_openings RLS is only org-scoped (no per-location gate), so
    // this app-level filter is the ONLY thing keeping a location-limited manager
    // from seeing every store's openings. It must mirror the applications query
    // above exactly: when a non-spanning member is on the "All locations" view
    // (effectiveLocation null — which a specific-locations manager lands on by
    // default), fall back to just their reachable locations + unassigned, never
    // the whole org. Only a super admin / all-locations member sees everything.
    let openingsQ = supabase
      .from("job_openings")
      .select("id, department, location_id, title, ad_copy, pay_note, employment_type, status, created_at, code, click_count")
      .order("created_at", { ascending: false });
    if (effectiveLocation) {
      openingsQ = openingsQ.or(`location_id.eq.${effectiveLocation},location_id.is.null`);
    } else if (!spansAllLocations) {
      const reachable = [profile.locationId, ...profile.accessibleLocationIds].filter(Boolean) as string[];
      const clauses = [...reachable.map((id) => `location_id.eq.${id}`), "location_id.is.null"];
      openingsQ = openingsQ.or(clauses.join(","));
    }
    const { data: opRows } = await openingsQ;
    if (opRows) {
      openings.push(...(opRows as OpeningRow[]));
      const { data: appCounts } = await supabase.from("job_applications").select("opening_id").not("opening_id", "is", null);
      for (const r of (appCounts ?? []) as { opening_id: string | null }[]) {
        if (r.opening_id) openingCounts[r.opening_id] = (openingCounts[r.opening_id] ?? 0) + 1;
      }
    }
    // The "post an opening" location picker. A location-limited manager should
    // only be able to post to the stores they manage, so narrow the picker to
    // their reachable locations (a super admin / all-locations member gets all).
    const { data: locRows } = await supabase.from("locations").select("id, name").order("name");
    const allOpeningLocs = (locRows ?? []) as { id: string; name: string }[];
    openingLocations = spansAllLocations
      ? allOpeningLocs
      : allOpeningLocs.filter((l) => l.id === profile.locationId || profile.accessibleLocationIds.includes(l.id));
  }

  const latestCandidate = allCandidates[0];
  const latestScorecard =
    latestCandidate && coreValues
      ? coreValues.map((v, i) => ({ title: v.title, score: latestCandidate.scores[i] ?? 0 }))
      : [];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Hire for your values</h1>
          <p className="text-base text-muted max-w-xl">
            Hospitality is the dominant thread for every department — but a cook and a server need very
            different people. Screen for both.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
          {canEdit && (
            <ScrollToButton
              targetId="applications"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2.5 hover:border-brick hover:text-brick transition-colors"
            >
              <Inbox size={15} /> See Applications{applicants.length > 0 ? ` (${applicants.length})` : ""}
            </ScrollToButton>
          )}
          <ScrollToButton
            targetId="candidate-scorecards"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2.5 hover:border-brick hover:text-brick transition-colors"
          >
            <Users size={15} /> See candidates{allCandidates.length > 0 ? ` (${allCandidates.length})` : ""}
          </ScrollToButton>
          <CandidateModalButton
            // Remount on a new score request so the mount-time auto-open fires
            // even when "Score after interview" navigates within /hiring (a
            // same-route nav re-renders but doesn't remount, so the open-state
            // initializer wouldn't re-run otherwise).
            key={prefillAppId ? `app-${prefillAppId}` : autoOpenDepartment ? `dept-${autoOpenDepartment}` : "new"}
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

      {canEdit && applicants.length > 0 && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-1">Applications by fit</div>
          <p className="text-[13px] text-muted mb-4">How your inbound applications screened, before you spend an interview. Dig into them in Applications below.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {fitTiles.map((t) => (
              <div key={t.key} className="bg-[#FAFAFA] rounded-[14px] p-4 flex items-center justify-between gap-2">
                <span className={`text-[12.5px] font-bold px-2.5 py-1 rounded-full ${t.bg} ${t.fg}`}>{t.label}</span>
                <span className="text-[22px] font-bold text-ink tabular-nums">{t.n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RoleManager active={activeDepts} inactive={inactiveDepts} canManage={canEdit} />

      <CollapsibleSection
        title="Interview criteria & questions"
        subtitle="The traits and interview questions you screen every candidate against, per role. Set once, then open to refine."
      >
        <HiringClient coreValues={coreValues ?? []} traitsByDept={traitsByDept} departments={activeDepts} canEdit={canEdit} />
      </CollapsibleSection>

      {canEdit && screeningRoles.length > 0 && (
        <CollapsibleSection
          title="Screening questions"
          subtitle="Short questions candidates answer on your application form, per role — Wingman drafts and grades them. Build once, open to tweak."
        >
          <ScreeningQuestionsPanel roles={screeningRoles} questionsByRole={screeningQuestionsByRole} />
        </CollapsibleSection>
      )}

      {canEdit && (
        <CollapsibleSection
          title="Job openings"
          subtitle="Post a role for a location, get an AI-written ad + a branded link to share on Indeed, Craigslist, or social. Set up once, open to post more."
        >
          <OpeningsPanel
            openings={openings}
            counts={openingCounts}
            locations={openingLocations}
            departments={activeDepts}
            applyUrl={applyUrl}
            careersUrl={careersUrl}
            siteUrl={SITE}
            canEdit={canEdit}
          />
        </CollapsibleSection>
      )}

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
          <ApplicantsPanel applicants={applicants} applyUrl={applyUrl} applySlug={orgApplyRow?.public_slug ?? null} applicationsCc={applicationsCc} logoUrl={orgLogoUrl} formConfig={formConfig} />
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
