"use client";

import { useState } from "react";
import { Heart, GraduationCap } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { signOffTraining } from "./actions";

// Rendered with `key={department}` by the caller so switching departments
// remounts this component and resets all local state naturally.
export function RoleChecklist({
  department,
  hospitalityItems,
  roleItems,
  trackLabel,
}: {
  department: string;
  hospitalityItems: string[];
  roleItems: string[];
  trackLabel: string | null;
}) {
  const [checkedH, setCheckedH] = useState<Record<number, boolean>>({});
  const [checkedR, setCheckedR] = useState<Record<number, boolean>>({});
  const [name, setName] = useState("");
  const [signingOff, setSigningOff] = useState(false);

  const totalItems = hospitalityItems.length + roleItems.length;
  const checkedCount =
    Object.values(checkedH).filter(Boolean).length + Object.values(checkedR).filter(Boolean).length;
  const pct = totalItems ? Math.round((checkedCount / totalItems) * 100) : 0;

  async function handleSignOff() {
    if (!name || pct !== 100) return;
    setSigningOff(true);
    await signOffTraining(name, department, pct);
    setSigningOff(false);
    setName("");
    setCheckedH({});
    setCheckedR({});
  }

  return (
    <div className="bg-panel border border-line rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-ink">{department} training program</h3>
        <span className={`font-mono text-sm font-semibold ${pct === 100 ? "text-olive" : "text-muted"}`}>
          {pct}% reviewed
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Heart size={14} className="text-brick" />
        <span className="text-xs font-semibold uppercase tracking-wide text-brick">
          Hospitality & guest experience — the standard
        </span>
      </div>
      <div className="flex flex-col gap-2.5 mb-5">
        {hospitalityItems.length === 0 && (
          <p className="text-sm text-muted">No standard defined yet for this department.</p>
        )}
        {hospitalityItems.map((item, i) => (
          <label key={i} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!checkedH[i]}
              onChange={(e) => setCheckedH({ ...checkedH, [i]: e.target.checked })}
              className="mt-1 accent-brick"
            />
            <span className={`text-sm leading-relaxed ${checkedH[i] ? "text-muted line-through" : "text-charcoal-2"}`}>
              {item}
            </span>
          </label>
        ))}
      </div>

      {trackLabel && (
        <>
          <div className="pt-5 mb-3 flex items-center gap-2 border-t border-line">
            <GraduationCap size={14} className="text-gold" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[#b45309]">
              {trackLabel} — role-specific
            </span>
          </div>
          <div className="flex flex-col gap-2.5 mb-5">
            {roleItems.map((item, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!checkedR[i]}
                  onChange={(e) => setCheckedR({ ...checkedR, [i]: e.target.checked })}
                  className="mt-1 accent-gold"
                />
                <span className={`text-sm leading-relaxed ${checkedR[i] ? "text-muted line-through" : "text-charcoal-2"}`}>
                  {item}
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-line">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Staff member name"
          className={`${inputClass} flex-1`}
        />
        <Btn onClick={handleSignOff} disabled={pct !== 100 || !name || signingOff}>
          Sign off {pct < 100 ? `(${pct}%)` : ""}
        </Btn>
      </div>
      {pct < 100 && totalItems > 0 && (
        <p className="text-xs text-muted mt-2">Check every item — hospitality and role-specific — before signing off.</p>
      )}
    </div>
  );
}
