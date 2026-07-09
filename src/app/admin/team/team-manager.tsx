"use client";

import { useActionState, useState, useTransition } from "react";
import { UserPlus, Sparkles } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { addPlatformStaff, updatePlatformStaffAccess, removePlatformStaff, type TeamState } from "./actions";

export type StaffRow = { id: string; fullName: string; email: string; access: string[] };
type Section = { key: string; label: string; description: string };

const initialState: TeamState = { error: null };

export function TeamManager({ staff, sections, currentUserId }: { staff: StaffRow[]; sections: Section[]; currentUserId: string }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Btn icon={UserPlus} onClick={() => setAdding(true)}>
          Add teammate
        </Btn>
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        {staff.length === 0 ? (
          <p className="text-sm text-muted p-6">No platform staff yet.</p>
        ) : (
          staff.map((s) => (
            <StaffCard key={s.id} staff={s} sections={sections} isSelf={s.id === currentUserId} />
          ))
        )}
      </div>

      {adding && <AddModal sections={sections} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddModal({ sections, onClose }: { sections: Section[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(addPlatformStaff, initialState);
  useCloseOnSuccess(pending, state.error, onClose);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function preset(keys: string[]) {
    setChecked(new Set(keys));
  }

  return (
    <Modal title="Add a teammate" sub="They need a Wingman account first (any org). Then choose what they can access." onClose={onClose} wide>
      <form action={formAction}>
        <Field label="Their email">
          <input name="email" type="email" required placeholder="teammate@themaverickagency.com" className={inputClass} />
        </Field>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-ink">Access</span>
          <button type="button" onClick={() => preset(["support"])} className="text-xs font-semibold text-brick hover:opacity-70 inline-flex items-center gap-1">
            <Sparkles size={12} /> Support agent
          </button>
          <span className="text-muted-2 text-xs">·</span>
          <button type="button" onClick={() => preset(sections.map((s) => s.key))} className="text-xs font-semibold text-brick hover:opacity-70">
            Full access
          </button>
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          {sections.map((sec) => (
            <label key={sec.key} className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="sections" value={sec.key} checked={checked.has(sec.key)} onChange={() => toggle(sec.key)} className="mt-0.5 accent-brick" />
              <span>
                <span className="text-ink font-medium">{sec.label}</span>
                <span className="text-muted-2"> — {sec.description}</span>
              </span>
            </label>
          ))}
        </div>

        {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <Btn type="button" kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" disabled={pending || checked.size === 0}>
            {pending ? "Adding…" : "Add teammate"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

function StaffCard({ staff, sections, isSelf }: { staff: StaffRow; sections: Section[]; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set(staff.access));
  const [pending, start] = useTransition();
  const [removing, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const labelFor = (k: string) => sections.find((s) => s.key === k)?.label ?? k;

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updatePlatformStaffAccess(staff.id, [...checked]);
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  function remove() {
    if (!window.confirm(`Remove ${staff.fullName || staff.email} from platform staff?`)) return;
    setError(null);
    startRemove(async () => {
      const res = await removePlatformStaff(staff.id);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="px-5 py-4 border-b border-[#F5F5F5] last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-ink">
            {staff.fullName || staff.email} {isSelf && <span className="text-xs text-muted-2">(you)</span>}
          </div>
          <div className="text-[13px] text-muted-2 truncate">{staff.email}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-[13px] font-semibold text-charcoal-2 hover:opacity-70">
            {editing ? "Cancel" : "Edit access"}
          </button>
          {!isSelf && (
            <button type="button" onClick={remove} disabled={removing} className="text-[13px] font-semibold text-brick hover:opacity-70 disabled:opacity-50">
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-3">
          <div className="flex flex-col gap-1.5">
            {sections.map((sec) => (
              <label key={sec.key} className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={checked.has(sec.key)} onChange={() => toggle(sec.key)} className="accent-brick" />
                <span className="text-ink">{sec.label}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end mt-3">
            <Btn small disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save access"}
            </Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {staff.access.length > 0 ? (
            staff.access.map((k) => (
              <span key={k} className="text-[11.5px] font-semibold text-charcoal-2 bg-paper border border-line px-2 py-0.5 rounded-full">
                {labelFor(k)}
              </span>
            ))
          ) : (
            <span className="text-[13px] text-muted-2">No sections</span>
          )}
        </div>
      )}
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
