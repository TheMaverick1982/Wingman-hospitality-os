"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, UserPlus, Users } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { ALL_DEPARTMENTS, type Department } from "@/lib/constants";
import type { Location } from "@/lib/data/locations";
import type { StaffMember } from "@/lib/data/staff";
import { addStaffMember } from "@/app/(app)/staff/actions";

export function StartTrainingButton({
  staff,
  locations,
  department,
  departments,
  small,
}: {
  staff: StaffMember[];
  locations: Location[];
  department?: Department;
  departments?: Department[];
  small?: boolean;
}) {
  const roles = departments && departments.length ? departments : ALL_DEPARTMENTS;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const filtered = department ? staff.filter((s) => s.department === department) : staff;
  const [selectedId, setSelectedId] = useState(filtered[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState<Department>(department ?? roles[0]);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const multiLocation = locations.length > 1;

  function go() {
    setError(null);
    if (mode === "existing") {
      if (!selectedId) return setError("Choose a staff member.");
      setOpen(false);
      router.push(`/staff/${selectedId}?tab=training`);
      return;
    }
    if (!newName.trim()) return setError("Name is required.");
    if (multiLocation && !locationId) return setError("Choose a location.");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("fullName", newName.trim());
      fd.set("department", newDept);
      fd.set("locationId", locationId);
      const result = await addStaffMember({ error: null }, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push(`/staff/${result.staffId}?tab=training`);
    });
  }

  return (
    <>
      <Btn small={small} icon={GraduationCap} onClick={() => setOpen(true)}>
        Start a training
      </Btn>
      {open && (
        <Modal
          title="Start a training"
          sub="Pick someone already on your team, or add a new person and jump straight into their training."
          onClose={() => setOpen(false)}
        >
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                mode === "existing" ? "border-brick bg-brick-tint text-brick-dark" : "border-line text-muted hover:border-line-strong"
              }`}
            >
              <Users size={14} /> Existing staff
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                mode === "new" ? "border-brick bg-brick-tint text-brick-dark" : "border-line text-muted hover:border-line-strong"
              }`}
            >
              <UserPlus size={14} /> New person
            </button>
          </div>

          {mode === "existing" ? (
            filtered.length > 0 ? (
              <Field label={department ? `${department} staff` : "Staff member"}>
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
                  {filtered.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                      {!department ? ` · ${s.department}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <p className="text-sm text-muted mb-2">No staff added yet — add a new person instead.</p>
            )
          ) : (
            <>
              <Field label="Full name">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
              </Field>
              {!department && (
                <Field label="Role">
                  <select value={newDept} onChange={(e) => setNewDept(e.target.value as Department)} className={inputClass}>
                    {roles.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {multiLocation && (
                <Field label="Location">
                  <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputClass}>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}

          {error && <p className="text-sm text-danger mb-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={go} disabled={pending || (mode === "existing" && filtered.length === 0)}>
              {pending ? "Starting..." : "Start training"}
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
