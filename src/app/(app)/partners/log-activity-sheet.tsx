"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { ACTIVITY_TYPES, type PartnerActivityType } from "@/lib/partners";
import { logActivity, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

// Right-side slide-out for logging a touch against a contact. call/email/meeting
// reset the fading clock; event/fundraiser also carry revenue (entered after the
// event happens).
export function LogActivitySheet({
  contacts,
  preselectContactId,
  onClose,
}: {
  contacts: { id: string; company_name: string }[];
  preselectContactId?: string | null;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(logActivity, initialState);
  useCloseOnSuccess(pending, state.error, onClose);
  const [type, setType] = useState<PartnerActivityType>("call_text");
  const today = new Date().toISOString().slice(0, 10);
  const isEvent = type === "event_booked" || type === "fundraiser_booked";

  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[440px] h-full bg-panel shadow-lg overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-line">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">Log activity</h2>
            <p className="text-sm mt-1 text-muted">Record a touch to keep the relationship warm.</p>
          </div>
          <button onClick={onClose} className="text-muted" type="button" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form action={formAction} className="p-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Contact</span>
            <select name="contact_id" defaultValue={preselectContactId ?? ""} required className={inputClass}>
              <option value="" disabled>
                Select a contact…
              </option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Activity type</span>
            <select
              name="activity_type"
              value={type}
              onChange={(e) => setType(e.target.value as PartnerActivityType)}
              className={inputClass}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Date</span>
            <input type="date" name="activity_date" defaultValue={today} className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">
              Revenue generated{" "}
              <span className="font-normal text-muted">{isEvent ? "(enter once you know it)" : "(optional)"}</span>
            </span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                name="revenue"
                placeholder="0.00"
                className={`${inputClass} pl-7`}
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Notes / details</span>
            <textarea
              name="notes"
              rows={4}
              placeholder="What was discussed, next steps, who you spoke with…"
              className={inputClass}
            />
          </label>

          {state.error && <p className="text-sm text-brick">{state.error}</p>}
          <div className="flex justify-end gap-2 mt-1">
            <Btn type="button" kind="ghost" onClick={onClose}>
              Cancel
            </Btn>
            <Btn type="submit" disabled={pending}>
              {pending ? "Logging…" : "Log activity"}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
