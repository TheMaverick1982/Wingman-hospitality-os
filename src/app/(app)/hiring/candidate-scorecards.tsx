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
  const [datePreset, setDatePreset] = useState(""); // "", "7", "30", "90", "custom"
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [now] = useState(() => Date.now());

  const multiLocation = locations.length > 1;

  // Resolve the active date window (YYYY-MM-DD strings, either bound optional).
  const { from, to } = useMemo(() => {
    if (datePreset === "custom") return { from: dateFrom, to: dateTo };
    if (datePreset === "7" || datePreset === "30" || datePreset === "90") {
      const days = Number(datePreset);
      return { from: new Date(now - days * 86400000).toISOString().slice(0, 10), to: "" };
    }
    return { from: "", to: "" };
  }, [datePreset, dateFrom, dateTo, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q)) &&
        (!locationId || c.locationId === locationId) &&
        (!recommendation || c.recommendation === recommendation) &&
        (!department || c.department === department) &&
        (!from || c.date >= from) &&
        (!to || c.date <= to)
    );
  }, [candidates, query, locationId, recommendation, department, from, to]);

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

  const anyFilter = query || locationId || recommendation || department || datePreset;

  return (
    <div id="candidate-scorecards" className="scroll-mt-6 flex flex-col gap-4">
      <h3 className="font-display text-lg font-semibold text-ink">Candidates</h3>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" className={`${inputClass} pl-9 py-2 w-full`} />
        </div>
        {multiLocation && (
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={`${inputClass} py-2 flex-1 min-w-0`}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={`${inputClass} py-2 flex-1 min-w-0`}>
          <option value="">All roles</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={recommendation} onChange={(e) => setRecommendation(e.target.value)} className={`${inputClass} py-2 flex-1 min-w-0`}>
          <option value="">All recommendations</option>
          {RECOMMENDATION_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} className={`${inputClass} py-2 flex-1 min-w-0`}>
          <option value="">Any date</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="custom">Custom range…</option>
        </select>
      </div>

      {datePreset === "custom" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-muted">
            From
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className={`${inputClass} py-2`} />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            To
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className={`${inputClass} py-2`} />
          </label>
        </div>
      )}

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

      <div className="bg-white border border-line rounded-2xl overflow-x-auto shadow-sm">
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
