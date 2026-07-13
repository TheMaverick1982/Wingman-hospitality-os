"use client";

import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { inputClass } from "@/components/ui/field";

export type StaffOption = { id: string; full_name: string; department: string };

/**
 * A form-field replacement: pick an existing person from the Staff roster
 * (submits their name as plain text, same as before) or type a brand-new
 * name. Keeps every call site's existing free-text column untouched.
 */
export function StaffPicker({
  name,
  staff,
  department,
  required,
  placeholder,
  onSelectExisting,
  defaultNewName,
}: {
  name: string;
  staff: StaffOption[];
  department?: string;
  required?: boolean;
  placeholder?: string;
  onSelectExisting?: (staff: StaffOption) => void;
  // Prefill a brand-new name (e.g. starting a scorecard from an application).
  defaultNewName?: string;
}) {
  const filtered = department ? staff.filter((s) => s.department === department) : staff;
  const [mode, setMode] = useState<"existing" | "new">(defaultNewName ? "new" : filtered.length > 0 ? "existing" : "new");
  const [selectedId, setSelectedId] = useState(filtered[0]?.id ?? "");
  const [newName, setNewName] = useState(defaultNewName ?? "");

  const selected = filtered.find((s) => s.id === selectedId);

  return (
    <div>
      {filtered.length > 0 && (
        <div className="flex gap-1 mb-1.5">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              mode === "existing" ? "bg-brick text-white" : "bg-paper text-muted"
            }`}
          >
            <Users size={11} /> Existing staff
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              mode === "new" ? "bg-brick text-white" : "bg-paper text-muted"
            }`}
          >
            <UserPlus size={11} /> New person
          </button>
        </div>
      )}
      {mode === "existing" && filtered.length > 0 ? (
        <select
          name={name}
          value={selected?.full_name ?? ""}
          onChange={(e) => {
            const s = filtered.find((f) => f.full_name === e.target.value);
            if (s) {
              setSelectedId(s.id);
              onSelectExisting?.(s);
            }
          }}
          required={required}
          className={inputClass}
        >
          {filtered.map((s) => (
            <option key={s.id} value={s.full_name}>
              {s.full_name}
              {!department ? ` · ${s.department}` : ""}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required={required}
          placeholder={placeholder ?? "Full name"}
          className={inputClass}
        />
      )}
    </div>
  );
}
