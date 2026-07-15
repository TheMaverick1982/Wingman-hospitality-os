"use client";

import { useActionState } from "react";
import { Modal } from "@/components/ui/modal";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { PARTNER_CATEGORIES } from "@/lib/partners";
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
};

const initialState: ActionState = { error: null };

export function ContactModal({
  contact,
  assignableLocations,
  defaultLocationId,
  canPickOrgWide,
  onClose,
}: {
  contact: ContactFormValue | null;
  assignableLocations: Location[];
  defaultLocationId: string | null;
  canPickOrgWide: boolean;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveContact, initialState);
  useCloseOnSuccess(pending, state.error, onClose);

  return (
    <Modal
      title={contact ? "Update contact" : "Add contact"}
      sub="A local business or person you're building a relationship with — for catering, events, fundraisers, and group visits."
      onClose={onClose}
      wide
    >
      <form action={formAction}>
        {contact && <input type="hidden" name="contactId" value={contact.id} />}

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
