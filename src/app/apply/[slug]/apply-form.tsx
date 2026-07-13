"use client";

import { useActionState } from "react";
import { CheckCircle2, Paperclip } from "lucide-react";
import { submitApplication, type ApplyState } from "./actions";
import { builtinSetting, type ApplicationFormConfig, type CustomField } from "@/lib/application-form";

const initial: ApplyState = { error: null };
const field = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-brick";
const label = "text-[13px] font-semibold text-ink block mb-1.5";

function Req({ on }: { on: boolean }) {
  return on ? <span className="text-danger"> *</span> : null;
}

function CustomFieldInput({ f }: { f: CustomField }) {
  const name = `custom_${f.id}`;
  return (
    <div>
      <label className={label}>
        {f.label}
        <Req on={f.required} />
      </label>
      {f.type === "long_text" ? (
        <textarea name={name} required={f.required} rows={3} className={field} />
      ) : f.type === "dropdown" ? (
        <select name={name} required={f.required} defaultValue="" className={field}>
          <option value="" disabled={f.required}>Select…</option>
          {(f.options ?? []).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      ) : f.type === "yes_no" ? (
        <select name={name} required={f.required} defaultValue="" className={field}>
          <option value="" disabled={f.required}>Select…</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      ) : f.type === "number" ? (
        <input name={name} type="number" required={f.required} className={field} />
      ) : (
        <input name={name} required={f.required} className={field} />
      )}
    </div>
  );
}

export function ApplyForm({
  slug,
  orgName,
  logoUrl,
  locations,
  roles,
  preRole,
  preLocation,
  embed,
  config,
}: {
  slug: string;
  orgName: string;
  logoUrl: string | null;
  locations: { id: string; name: string }[];
  roles: string[];
  preRole: string;
  preLocation: string;
  embed: boolean;
  config: ApplicationFormConfig;
}) {
  const [state, formAction, pending] = useActionState(submitApplication.bind(null, slug), initial);

  const email = builtinSetting(config, "email");
  const phone = builtinSetting(config, "phone");
  const department = builtinSetting(config, "department");
  const location = builtinSetting(config, "location");
  const availability = builtinSetting(config, "availability");
  const preferredVisit = builtinSetting(config, "preferredVisit");
  const message = builtinSetting(config, "message");
  const resume = builtinSetting(config, "resume");
  const showLocation = location.enabled && locations.length > 0;

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
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-ink">{config.headline?.trim() || `Join the ${orgName} team`}</h1>
        <p className="text-muted text-[14px] mt-1">{config.intro?.trim() || "Tell us a bit about you — it only takes a minute."}</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {embed && <input type="hidden" name="embed" value="1" />}

        <div>
          <label className={label}>Your name<Req on /></label>
          <input name="name" required className={field} placeholder="Full name" />
        </div>

        {(email.enabled || phone.enabled) && (
          <div className={`grid grid-cols-1 ${email.enabled && phone.enabled ? "sm:grid-cols-2" : ""} gap-4`}>
            {email.enabled && (
              <div>
                <label className={label}>{email.label}<Req on={email.required} /></label>
                <input name="email" type="email" required={email.required} className={field} placeholder="you@email.com" />
              </div>
            )}
            {phone.enabled && (
              <div>
                <label className={label}>{phone.label}<Req on={phone.required} /></label>
                <input name="phone" required={phone.required} className={field} placeholder="(555) 555-5555" />
              </div>
            )}
          </div>
        )}

        {(department.enabled || showLocation) && (
          <div className={`grid grid-cols-1 ${department.enabled && showLocation ? "sm:grid-cols-2" : ""} gap-4`}>
            {department.enabled && (
              <div>
                <label className={label}>{department.label}<Req on={department.required} /></label>
                <select name="department" required={department.required} defaultValue={preRole} className={field}>
                  <option value="">{department.required ? "Select a role…" : "Any role"}</option>
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
            {showLocation && (
              <div>
                <label className={label}>{location.label}<Req on={location.required} /></label>
                <select name="locationId" required={location.required} defaultValue={preLocation} className={field}>
                  <option value="">{location.required ? "Select a location…" : "No preference"}</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {availability.enabled && (
          <div>
            <label className={label}>{availability.label}<Req on={availability.required} /></label>
            <input name="availability" required={availability.required} className={field} placeholder="e.g. Weeknights & weekends, can start next week" />
          </div>
        )}

        {preferredVisit.enabled && (
          <div>
            <label className={label}>{preferredVisit.label}<Req on={preferredVisit.required} /></label>
            <input name="preferredVisit" type="datetime-local" required={preferredVisit.required} className={field} />
            <p className="text-[12px] text-muted-2 mt-1">Pick a day/time that works and we&rsquo;ll confirm.</p>
          </div>
        )}

        {message.enabled && (
          <div>
            <label className={label}>{message.label}<Req on={message.required} /></label>
            <textarea name="message" required={message.required} rows={3} className={field} placeholder="A sentence on why you'd be a great fit" />
          </div>
        )}

        {config.custom.map((f) => <CustomFieldInput key={f.id} f={f} />)}

        {resume.enabled && (
          <div>
            <label className={label}>{resume.label} {!resume.required && <span className="font-normal text-muted-2">(optional)</span>}<Req on={resume.required} /></label>
            <label className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3.5 py-2.5 text-[14px] text-muted cursor-pointer hover:border-brick">
              <Paperclip size={15} />
              <span>Attach a PDF or image</span>
              <input name="resume" type="file" accept="application/pdf,image/*" required={resume.required} className="sr-only" onChange={(e) => {
                const el = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (el) el.textContent = e.currentTarget.files?.[0]?.name ?? "";
              }} />
              <span className="text-[13px] text-charcoal-2 truncate" />
            </label>
          </div>
        )}

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
