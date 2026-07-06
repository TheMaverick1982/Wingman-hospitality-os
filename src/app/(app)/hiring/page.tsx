import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations, resolveEffectiveLocation } from "@/lib/data/locations";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { Pill } from "@/components/ui/pill";
import { HiringClient, type HiringTrait } from "./hiring-client";
import { CandidateModalButton } from "./candidate-modal";

export default async function HiringPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const isGm = profile.accessRole === "gm";

  const { location } = await searchParams;
  const effectiveLocation = resolveEffectiveLocation({
    accessRole: profile.accessRole,
    userLocationId: profile.locationId,
    requestedLocationId: location,
  });

  const supabase = await createClient();

  let candidatesQ = supabase.from("candidates").select("*").order("occurred_on", { ascending: false });
  if (effectiveLocation) candidatesQ = candidatesQ.eq("location_id", effectiveLocation);

  const [{ data: coreValues }, { data: hiringTraits }, { data: candidates }, locations] = await Promise.all([
    supabase
      .from("core_values")
      .select("title, description, hiring_question, hiring_green_flag, hiring_red_flag")
      .order("sort_order"),
    supabase.from("hiring_traits").select("department, title, question, green_flag, red_flag").order("sort_order"),
    candidatesQ,
    getOrgLocations(),
  ]);

  const traitsByDept = {} as Record<Department, HiringTrait[]>;
  for (const d of ALL_DEPARTMENTS) {
    traitsByDept[d] = (hiringTraits ?? [])
      .filter((t) => t.department === d)
      .map((t) => ({ title: t.title, question: t.question, green_flag: t.green_flag, red_flag: t.red_flag }));
  }

  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Hiring</h1>
          <p className="text-sm text-muted max-w-xl">
            Hospitality is the dominant thread for every department — but a cook and a server need very
            different people. Screen for both.
          </p>
        </div>
        <CandidateModalButton
          coreValueTitles={(coreValues ?? []).map((v) => v.title)}
          traitsByDept={Object.fromEntries(
            Object.entries(traitsByDept).map(([d, traits]) => [d, traits.map((t) => t.title)])
          ) as Record<Department, string[]>}
          locations={locations}
          isGm={isGm}
          lockedLocationName={profile.locationName}
          defaultLocationId={effectiveLocation ?? profile.locationId}
          defaultDepartment={ALL_DEPARTMENTS[1]}
        />
      </div>

      <HiringClient coreValues={coreValues ?? []} traitsByDept={traitsByDept} />

      <h3 className="font-display text-lg font-semibold mb-3 text-ink">Candidate scorecards</h3>
      <div className="bg-panel border border-line rounded-[10px] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {["Candidate", "Department", "Location", "Date", "Avg score", "Recommendation"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(candidates ?? []).map((c) => {
              const avg = c.scores.reduce((a: number, b: number) => a + b, 0) / c.scores.length;
              return (
                <tr key={c.id} className="border-b border-line">
                  <td className="px-5 py-3.5 text-ink">{c.name}</td>
                  <td className="px-5 py-3.5 text-muted">{c.department}</td>
                  <td className="px-5 py-3.5 text-muted">{locationName(c.location_id)}</td>
                  <td className="px-5 py-3.5 text-muted">{c.occurred_on}</td>
                  <td className="px-5 py-3.5 text-ink font-mono">{avg.toFixed(1)} / 5</td>
                  <td className="px-5 py-3.5">
                    <Pill tone={c.recommendation === "Strong fit" ? "olive" : c.recommendation === "Not a fit" ? "brick" : "gold"}>
                      {c.recommendation}
                    </Pill>
                  </td>
                </tr>
              );
            })}
            {(candidates ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted">
                  No candidates scored yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
