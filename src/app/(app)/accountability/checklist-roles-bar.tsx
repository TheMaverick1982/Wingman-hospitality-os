"use client";

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { setChecklistRoles } from "./custom-checklist-actions";

// Role-assignment control shown above a built-in staff checklist's editor. Empty
// selection = all staff. Lets the owner control who sees the checklist on login.
export function ChecklistRolesBar({
  checklistType,
  departments,
  options,
}: {
  checklistType: string;
  departments: string[];
  options: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<string[]>(departments);
  const [pending, start] = useTransition();

  const toggle = (d: string) => setSel((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  function save() {
    start(async () => {
      await setChecklistRoles(checklistType, sel);
      setEditing(false);
    });
  }

  const label = departments.length > 0 ? departments.join(", ") : "All staff";

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-charcoal-2 bg-paper border border-line rounded-full px-2.5 py-1">
          <Users size={12} /> {label}
        </span>
        <button type="button" onClick={() => setEditing(true)} className="text-[12px] font-semibold text-muted-2 hover:text-brick">
          Assign roles
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 bg-paper border border-line rounded-xl p-3">
      <div className="text-[12px] font-semibold text-charcoal-2">
        Who sees this on login? <span className="text-muted-2 font-normal">— none selected = all staff</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((d) => {
          const on = sel.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              className={`text-[12.5px] font-semibold rounded-full px-3 py-1 border transition-colors ${
                on ? "border-brick bg-brick-tint text-brick" : "border-line text-charcoal-2 hover:border-brick/50"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Btn small kind="ghost" onClick={() => { setSel(departments); setEditing(false); }}>
          Cancel
        </Btn>
        <Btn small onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Btn>
      </div>
    </div>
  );
}
