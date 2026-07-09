import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { getStaffMembers } from "@/lib/data/staff";
import { getSectionAccess, canEditSection } from "@/lib/auth/permissions";
import { ALL_DEPARTMENTS, RECOMMENDATION_OPTIONS, type Department } from "@/lib/constants";
import { Pill } from "@/components/ui/pill";
import { StatusPill } from "@/components/ui/status-pill";
import { HiringClient, type HiringTrait } from "./hiring-client";
import { CandidateModalButton } from "./candidate-modal";
import { HireCandidateButton } from "./hire-candidate-button";

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
  searchParams: Promise<{ location?: string; scoreDept?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "hiring", profile.permissionOverrides) === "none") redirect("/dashboard");
  const isSuperAdmin = profile.accessRole === "super_admin";
  const canEdit = canEditSection(profile.accessRole, "hiring", profile.permissionOverrides);

  const { location, scoreDept } = await searchParams;
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

  const [{ data: coreValues }, { data: hiringTraits }, { data: candidates }, locations, staff] = await Promise.all([
    supabase
      .from("core_values")
      .select("title, description, hiring_question, hiring_green_flag, hiring_red_flag")
      .order("sort_order"),
    supabase.from("hiring_traits").select("id, department, title, question, green_flag, red_flag, source").order("sort_order"),
    candidatesQ,
    getOrgLocations(),
    getStaffMembers(null),
  ]);

  const traitsByDept = {} as Record<Department, HiringTrait[]>;
  for (const d of ALL_DEPARTMENTS) {
    traitsByDept[d] = (hiringTraits ?? [])
      .filter((t) => t.department === d)
      .map((t) => ({ id: t.id, title: t.title, question: t.question, green_flag: t.green_flag, red_flag: t.red_flag, source: t.source }));
  }

  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
  const allCandidates = candidates ?? [];

  const { data: hiredStaff } = await supabase.from("staff_members").select("candidate_id").not("candidate_id", "is", null);
  const hiredCandidateIds = new Set((hiredStaff ?? []).map((s) => s.candidate_id));

  const byDepartment = ALL_DEPARTMENTS.map((d) => {
    const cands = allCandidates.filter((c) => c.department === d);
    const counts: Record<string, number> = {};
    for (const c of cands) counts[c.recommendation] = (counts[c.recommendation] ?? 0) + 1;
    const topRec = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { department: d, count: cands.length, status: topRec };
  }).filter((r) => r.count > 0);

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
        <div className="shrink-0">
          <CandidateModalButton
            coreValueTitles={(coreValues ?? []).map((v) => v.title)}
            traitsByDept={Object.fromEntries(
              Object.entries(traitsByDept).map(([d, traits]) => [d, traits.map((t) => t.title)])
            ) as Record<Department, string[]>}
            locations={locations}
            staff={staff}
            isGm={isSuperAdmin}
            lockedLocationName={profile.locationName}
            defaultLocationId={effectiveLocation ?? profile.locationId}
            defaultDepartment={ALL_DEPARTMENTS[1]}
            autoOpenDepartment={autoOpenDepartment}
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-[#F1F1F1] text-[17px] font-semibold tracking-[-0.01em] text-ink">
            Candidates by department
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAFAFA] text-left">
                <th className="px-6 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Role</th>
                <th className="px-4 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Candidates</th>
                <th className="px-6 py-3 text-[11.5px] font-semibold text-muted uppercase tracking-[0.03em] border-b border-line">Leading signal</th>
              </tr>
            </thead>
            <tbody>
              {byDepartment.map((r) => {
                const tone = RECOMMENDATION_TONE[r.status as keyof typeof RECOMMENDATION_TONE];
                return (
                  <tr key={r.department} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-6 py-3.5 font-medium text-ink border-b border-[#F5F5F5]">{r.department}</td>
                    <td className="px-4 py-3.5 text-muted border-b border-[#F5F5F5] tabular-nums">{r.count}</td>
                    <td className="px-6 py-3.5 border-b border-[#F5F5F5]">
                      {tone && <StatusPill label={r.status ?? ""} fg={tone.fg} bg={tone.bg} dot="bg-current" />}
                    </td>
                  </tr>
                );
              })}
              {byDepartment.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-muted">
                    No candidates scored yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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

      <HiringClient coreValues={coreValues ?? []} traitsByDept={traitsByDept} canEdit={canEdit} />

      <div>
        <h3 className="font-display text-lg font-semibold mb-3 text-ink">Candidate scorecards</h3>
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-line">
                {["Candidate", "Department", "Location", "Date", "Avg score", "Recommendation", "Staff"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allCandidates.map((c) => {
                const avg = c.scores.reduce((a: number, b: number) => a + b, 0) / c.scores.length;
                return (
                  <tr key={c.id} className="border-b border-line hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-5 py-3.5 text-ink">{c.name}</td>
                    <td className="px-5 py-3.5 text-muted">{c.department}</td>
                    <td className="px-5 py-3.5 text-muted">{locationName(c.location_id)}</td>
                    <td className="px-5 py-3.5 text-muted">{c.occurred_on}</td>
                    <td className="px-5 py-3.5 text-ink font-semibold tabular-nums">{avg.toFixed(1)} / 5</td>
                    <td className="px-5 py-3.5">
                      <Pill dot tone={c.recommendation === "Strong fit" ? "olive" : c.recommendation === "Not a fit" ? "danger" : "gold"}>
                        {c.recommendation}
                      </Pill>
                    </td>
                    <td className="px-5 py-3.5">
                      {canEdit && <HireCandidateButton candidateId={c.id} alreadyHired={hiredCandidateIds.has(c.id)} />}
                    </td>
                  </tr>
                );
              })}
              {allCandidates.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted">
                    No candidates scored yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
