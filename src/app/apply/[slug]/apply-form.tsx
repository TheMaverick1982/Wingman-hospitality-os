"use client";

import { useActionState } from "react";
import { CheckCircle2, Paperclip } from "lucide-react";
import { submitApplication, type ApplyState } from "./actions";

const initial: ApplyState = { error: null };
const field = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-brick";
const label = "text-[13px] font-semibold text-ink block mb-1.5";

export function ApplyForm({
  slug,
  orgName,
  logoUrl,
  locations,
  roles,
  preRole,
  preLocation,
  embed,
}: {
  slug: string;
  orgName: string;
  logoUrl: string | null;
  locations: { id: string; name: string }[];
  roles: string[];
  preRole: string;
  preLocation: string;
  embed: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitApplication.bind(null, slug), initial);

  if (state.ok) {
    return (
      <div className="bg-white border border-line rounded-2xl p-8 text-center shadow-sm">
        <CheckCircle2 size={36} className="mx-auto text-[#15803d] mb-3" />
        <h1 className="text-[22px] font-bold text-ink mb-1">Application sent</h1>
        <p className="text-muted text-[15px] max-w-sm mx-auto">
          Thanks for applying to {orgName}. The team has your info and will reach out about next steps.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col items-center text-center mb-6">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={orgName} className="h-12 w-auto mb-3 object-contain" />
        ) : null}
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-ink">Join the {orgName} team</h1>
        <p className="text-muted text-[14px] mt-1">Tell us a bit about you — it only takes a minute.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {embed && <input type="hidden" name="embed" value="1" />}

        <div>
          <label className={label}>Your name</label>
          <input name="name" required className={field} placeholder="Full name" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Email</label>
            <input name="email" type="email" className={field} placeholder="you@email.com" />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input name="phone" className={field} placeholder="(555) 555-5555" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Role you want</label>
            <select name="department" defaultValue={preRole} className={field}>
              <option value="">Any role</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {locations.length > 0 && (
            <div>
              <label className={label}>Location</label>
              <select name="locationId" defaultValue={preLocation} className={field}>
                <option value="">No preference</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className={label}>Availability</label>
          <input name="availability" className={field} placeholder="e.g. Weeknights & weekends, can start next week" />
        </div>

        <div>
          <label className={label}>When could you come in?</label>
          <input name="preferredVisit" type="datetime-local" className={field} />
          <p className="text-[12px] text-muted-2 mt-1">Optional — pick a day/time that works and we&rsquo;ll confirm.</p>
        </div>

        <div>
          <label className={label}>Anything else?</label>
          <textarea name="message" rows={3} className={field} placeholder="A sentence on why you'd be a great fit (optional)" />
        </div>

        <div>
          <label className={label}>Resume <span className="font-normal text-muted-2">(optional)</span></label>
          <label className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3.5 py-2.5 text-[14px] text-muted cursor-pointer hover:border-brick">
            <Paperclip size={15} />
            <span>Attach a PDF or image</span>
            <input name="resume" type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => {
              const el = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (el) el.textContent = e.currentTarget.files?.[0]?.name ?? "";
            }} />
            <span className="text-[13px] text-charcoal-2 truncate" />
          </label>
        </div>

        {state.error && <p className="text-[14px] text-danger">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 w-full text-[15px] font-semibold text-white bg-brick rounded-full px-5 py-3 hover:bg-brick-dark transition-colors disabled:opacity-60"
        >
          {pending ? "Sending…" : "Submit application"}
        </button>
        {!embed && <p className="text-[11.5px] text-muted-2 text-center">Powered by Wingman</p>}
      </form>
    </div>
  );
}
