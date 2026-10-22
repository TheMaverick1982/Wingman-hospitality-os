"use client";

import { useActionState } from "react";
import { Modal } from "@/components/ui/modal";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { PARTNER_CATEGORIES, OUTREACH_STATUSES, INTERESTED_IN_OPTIONS, type OutreachStatus } from "@/lib/partners";
import type { Location } from "@/lib/data/locations";
import { saveContact, type ActionState } from "./actions";

export type ContactFormValue = {
  id: string;
  location_id: string | null;
  company_name: string;
  contact_name: string;
  title: string;
  email: string;
  phone: string;
  category: string;
  subcategory: string;
  website: string;
  address: string;
  notes: string;
  outreach_status?: OutreachStatus;
  interested_in?: string[];
  handed_off_to?: string;
  next_step?: string;
};

const initialState: ActionState = { error: null };

export function ContactModal({
  contact,
  assignableLocations,
  defaultLocationId,
  canPickOrgWide,
  handoffTargets,
  onClose,
}: {
  contact: ContactFormValue | null;
  assignableLocations: Location[];
  defaultLocationId: string | null;
  canPickOrgWide: boolean;
  handoffTargets: string[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveContact, initialState);
  useCloseOnSuccess(pending, state.error, onClose);
  // A contact with no id is a new record (e.g. pre-filled from a card scan);
  // only an existing id means we're editing.
  const isEdit = !!contact?.id;

  return (
    <Modal
      title={isEdit ? "Update contact" : "Add contact"}
      sub="A local business or person you're building a relationship with — for catering, events, fundraisers, and group visits."
      onClose={onClose}
      wide
    >
      <form action={formAction}>
        {isEdit && <input type="hidden" name="contactId" value={contact!.id} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Company / organization</span>
            <input name="company_name" defaultValue={contact?.company_name} required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Location</span>
            <select name="location_id" defaultValue={contact?.location_id ?? defaultLocationId ?? ""} className={inputClass}>
              {canPickOrgWide && <option value="">Org-wide (all stores)</option>}
              {assignableLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Contact name</span>
            <input name="contact_name" defaultValue={contact?.contact_name} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Title / role</span>
            <input name="title" defaultValue={contact?.title} placeholder="e.g. Office Manager" className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Email</span>
            <input name="email" type="email" defaultValue={contact?.email} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Phone</span>
            <input name="phone" defaultValue={contact?.phone} className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Category</span>
            <input
              name="category"
              defaultValue={contact?.category}
              list="partner-categories"
              placeholder="e.g. Corporate Office"
              className={inputClass}
            />
            <datalist id="partner-categories">
              {PARTNER_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Subcategory</span>
            <input name="subcategory" defaultValue={contact?.subcategory} placeholder="Optional" className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Website</span>
            <input name="website" defaultValue={contact?.website} placeholder="https://" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Address</span>
            <input name="address" defaultValue={contact?.address} className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Status</span>
            <select name="outreach_status" defaultValue={contact?.outreach_status ?? "none"} className={inputClass}>
              {OUTREACH_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Handed off to</span>
            <select name="handed_off_to" defaultValue={contact?.handed_off_to ?? ""} className={inputClass}>
              <option value="">None yet</option>
              {handoffTargets.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {/* Preserve a previously-set value even if it's since been removed from the list. */}
              {contact?.handed_off_to && !handoffTargets.includes(contact.handed_off_to) && (
                <option value={contact.handed_off_to}>{contact.handed_off_to}</option>
              )}
            </select>
          </label>
        </div>

        <fieldset className="mb-4">
          <legend className="text-sm font-semibold text-ink mb-1.5">Interested in</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {INTERESTED_IN_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  name="interested_in"
                  value={opt}
                  defaultChecked={contact?.interested_in?.includes(opt) ?? false}
                  className="w-4 h-4 accent-brick"
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm mb-4">
          <span className="font-semibold text-ink">Result / next step</span>
          <input
            name="next_step"
            defaultValue={contact?.next_step}
            placeholder="e.g. Send catering menu, follow up next Tuesday"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm mb-4">
          <span className="font-semibold text-ink">Notes</span>
          <textarea
            name="notes"
            defaultValue={contact?.notes}
            rows={3}
            placeholder="How you met, what they're interested in, key details…"
            className={inputClass}
          />
        </label>

        {state.error && <p className="text-sm text-brick mb-2">{state.error}</p>}
        <div className="flex justify-end gap-2 mt-2">
          <Btn type="button" kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" disabled={pending}>
            {pending ? "Saving…" : contact ? "Save contact" : "Add contact"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
