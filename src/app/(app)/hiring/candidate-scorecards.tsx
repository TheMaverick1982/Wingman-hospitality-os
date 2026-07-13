"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { inputClass } from "@/components/ui/field";
import { RECOMMENDATION_OPTIONS } from "@/lib/constants";
import { HireCandidateButton } from "./hire-candidate-button";

export type ScorecardRow = {
  id: string;
  name: string;
  department: string;
  locationId: string;
  locationName: string;
  date: string;
  avg: number;
  recommendation: string;
  hired: boolean;
};

const REC_TONE: Record<string, "olive" | "danger" | "gold"> = {
  "Strong fit": "olive",
  Fit: "gold",
  Unsure: "gold",
  "Not a fit": "danger",
};

export function CandidatesPanel({
  candidates,
  locations,
  departments,
  canEdit,
  isSuperAdmin,
}: {
  candidates: ScorecardRow[];
  locations: { id: string; name: string }[];
  departments: string[];
  canEdit: boolean;
  isSuperAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const [locationId, setLocationId] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [department, setDepartment] = useState("");

  const multiLocation = locations.length > 1;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q)) &&
        (!locationId || c.locationId === locationId) &&
        (!recommendation || c.recommendation === recommendation) &&
        (!department || c.department === department)
    );
  }, [candidates, query, locationId, recommendation, department]);

  // Live "by department" summary of whatever's currently filtered.
  const byDept = useMemo(() => {
    const map = new Map<string, { count: number; recs: Record<string, number> }>();
    for (const c of filtered) {
      const e = map.get(c.department) ?? { count: 0, recs: {} };
      e.count++;
      e.recs[c.recommendation] = (e.recs[c.recommendation] ?? 0) + 1;
      map.set(c.department, e);
    }
    return [...map.entries()]
      .map(([dept, e]) => ({ dept, count: e.count, leading: Object.entries(e.recs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "" }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const anyFilter = query || locationId || recommendation || department;

  return (
    <div id="candidate-scorecards" className="scroll-mt-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-display text-lg font-semibold text-ink">Candidates</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" className={`${inputClass} pl-9 py-2 w-[170px]`} />
          </div>
          {multiLocation && (
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={`${inputClass} py-2 w-[150px]`}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={`${inputClass} py-2 w-[150px]`}>
            <option value="">All roles</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select value={recommendation} onChange={(e) => setRecommendation(e.target.value)} className={`${inputClass} py-2 w-[150px]`}>
            <option value="">All recommendations</option>
            {RECOMMENDATION_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* By-department summary — reflects the active filters. */}
      {byDept.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byDept.map((r) => (
            <button
              key={r.dept}
              type="button"
              onClick={() => setDepartment((d) => (d === r.dept ? "" : r.dept))}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                department === r.dept ? "bg-charcoal text-white border-charcoal" : "bg-white text-charcoal-2 border-line hover:border-brick"
              }`}
            >
              {r.dept}
              <span className={`tabular-nums ${department === r.dept ? "text-white/80" : "text-muted-2"}`}>{r.count}</span>
              {r.leading && (
                <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full ${department === r.dept ? "bg-white/20" : "bg-paper"}`}>
                  {r.leading}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-line">
                {["Candidate", "Department", "Location", "Date", "Avg score", "Recommendation", "Staff"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-line hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-5 py-3.5 text-ink">{c.name}</td>
                  <td className="px-5 py-3.5 text-muted">{c.department}</td>
                  <td className="px-5 py-3.5 text-muted">{c.locationName}</td>
                  <td className="px-5 py-3.5 text-muted">{c.date}</td>
                  <td className="px-5 py-3.5 text-ink font-semibold tabular-nums">{c.avg.toFixed(1)} / 5</td>
                  <td className="px-5 py-3.5">
                    <Pill dot tone={REC_TONE[c.recommendation] ?? "gold"}>{c.recommendation}</Pill>
                  </td>
                  <td className="px-5 py-3.5">
                    {canEdit && <HireCandidateButton candidateId={c.id} alreadyHired={c.hired} canInvite={isSuperAdmin} />}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted">
                    {candidates.length === 0 ? "No candidates scored yet." : anyFilter ? "No candidates match your filters." : "No candidates."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
