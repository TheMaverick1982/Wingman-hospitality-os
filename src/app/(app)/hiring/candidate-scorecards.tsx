"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { inputClass } from "@/components/ui/field";
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

export function CandidateScorecards({
  candidates,
  locations,
  canEdit,
  isSuperAdmin,
}: {
  candidates: ScorecardRow[];
  locations: { id: string; name: string }[];
  canEdit: boolean;
  isSuperAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const [locationId, setLocationId] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter(
      (c) => (!q || c.name.toLowerCase().includes(q)) && (!locationId || c.locationId === locationId)
    );
  }, [candidates, query, locationId]);

  const multiLocation = locations.length > 1;

  return (
    <div id="candidate-scorecards" className="scroll-mt-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h3 className="font-display text-lg font-semibold text-ink">Candidate scorecards</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
              className={`${inputClass} pl-9 py-2 w-[180px]`}
            />
          </div>
          {multiLocation && (
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={`${inputClass} py-2 w-[160px]`}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

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
                    <Pill dot tone={c.recommendation === "Strong fit" ? "olive" : c.recommendation === "Not a fit" ? "danger" : "gold"}>
                      {c.recommendation}
                    </Pill>
                  </td>
                  <td className="px-5 py-3.5">
                    {canEdit && <HireCandidateButton candidateId={c.id} alreadyHired={c.hired} canInvite={isSuperAdmin} />}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted">
                    {candidates.length === 0 ? "No candidates scored yet." : "No candidates match your search."}
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
