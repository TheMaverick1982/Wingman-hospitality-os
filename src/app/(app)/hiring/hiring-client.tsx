"use client";

import { useState } from "react";
import { Heart, GraduationCap } from "lucide-react";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import { hiringGuidanceFor, type CoreValueRow } from "@/lib/hiring";

export type HiringTrait = { title: string; question: string; green_flag: string; red_flag: string };

export function HiringClient({
  coreValues,
  traitsByDept,
}: {
  coreValues: CoreValueRow[];
  traitsByDept: Record<Department, HiringTrait[]>;
}) {
  const [activeRole, setActiveRole] = useState<Department>(ALL_DEPARTMENTS[0]);

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {ALL_DEPARTMENTS.map((d) => (
          <button
            key={d}
            onClick={() => setActiveRole(d)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
              activeRole === d ? "bg-charcoal text-white border-charcoal" : "bg-white text-ink border-line"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Heart size={14} className="text-brick" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brick">
          Universal — every department is screened for this
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 mb-6">
        {coreValues.map((v) => {
          const g = hiringGuidanceFor(v);
          return (
            <div key={v.title} className="bg-panel border border-line rounded-[10px] p-5">
              <p className="text-sm font-semibold mb-2 text-ink">{v.title}</p>
              <p className="text-sm mb-3 text-charcoal-2">&quot;{g.question}&quot;</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-olive-tint rounded-lg p-3">
                  <span className="text-xs font-semibold block mb-1 text-[#354328]">Green flag</span>
                  <span className="text-xs text-[#354328]">{g.green}</span>
                </div>
                <div className="bg-brick-tint rounded-lg p-3">
                  <span className="text-xs font-semibold block mb-1 text-brick-dark">Red flag</span>
                  <span className="text-xs text-brick-dark">{g.red}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <GraduationCap size={14} className="text-gold" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8A5D18]">
          {activeRole}-specific — what this department needs beyond hospitality
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 mb-8">
        {traitsByDept[activeRole].map((t) => (
          <div key={t.title} className="bg-panel border border-line rounded-[10px] p-5">
            <p className="text-sm font-semibold mb-2 text-ink">{t.title}</p>
            <p className="text-sm mb-3 text-charcoal-2">&quot;{t.question}&quot;</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-olive-tint rounded-lg p-3">
                <span className="text-xs font-semibold block mb-1 text-[#354328]">Green flag</span>
                <span className="text-xs text-[#354328]">{t.green_flag}</span>
              </div>
              <div className="bg-brick-tint rounded-lg p-3">
                <span className="text-xs font-semibold block mb-1 text-brick-dark">Red flag</span>
                <span className="text-xs text-brick-dark">{t.red_flag}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
