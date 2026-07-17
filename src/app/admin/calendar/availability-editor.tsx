"use client";

import { useMemo } from "react";
import { Plus, X } from "lucide-react";
import { inputClass } from "@/components/ui/field";
import type { AvailabilityRule } from "@/lib/calendar/availability";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Weekly availability editor shared by the personal booking page and the shared
// demo-pool config. Controlled: parent owns the rules array.
export function AvailabilityEditor({
  rules,
  onChange,
}: {
  rules: AvailabilityRule[];
  onChange: (rules: AvailabilityRule[]) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<number, { rule: AvailabilityRule; index: number }[]>();
    rules.forEach((rule, index) => {
      const arr = map.get(rule.weekday) ?? [];
      arr.push({ rule, index });
      map.set(rule.weekday, arr);
    });
    return map;
  }, [rules]);

  const add = (weekday: number) => onChange([...rules, { weekday, start: "09:00", end: "17:00" }]);
  const remove = (index: number) => onChange(rules.filter((_, i) => i !== index));
  const update = (index: number, patch: Partial<AvailabilityRule>) =>
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-2">
      {WEEKDAYS.map((label, weekday) => {
        const dayRules = byDay.get(weekday) ?? [];
        return (
          <div key={weekday} className="flex items-start gap-3 border border-line rounded-xl px-4 py-3">
            <div className="w-24 shrink-0 text-sm font-medium text-ink pt-1.5">{label}</div>
            <div className="flex-1 flex flex-col gap-2">
              {dayRules.length === 0 && <span className="text-sm text-muted pt-1.5">Unavailable</span>}
              {dayRules.map(({ rule, index }) => (
                <div key={index} className="flex items-center gap-2">
                  <input type="time" value={rule.start} onChange={(e) => update(index, { start: e.target.value })} className={`${inputClass} w-32`} />
                  <span className="text-muted text-sm">to</span>
                  <input type="time" value={rule.end} onChange={(e) => update(index, { end: e.target.value })} className={`${inputClass} w-32`} />
                  <button onClick={() => remove(index)} type="button" className="text-muted hover:text-danger p-1">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => add(weekday)} type="button" className="text-sm text-brick font-medium inline-flex items-center gap-1 pt-1.5 shrink-0">
              <Plus size={14} /> Add
            </button>
          </div>
        );
      })}
    </div>
  );
}
