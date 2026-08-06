"use client";

import { useActionState, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { HoneypotField } from "@/components/honeypot-field";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { RATING_QUESTIONS } from "@/lib/guest-survey";
import { submitSurvey, type SurveyState } from "./actions";

const initial: SurveyState = { error: null };

type ServerOption = { id: string; firstName: string };

export function SurveyForm({
  code,
  orgName,
  locationName,
  logoUrl,
  servers,
}: {
  code: string;
  orgName: string;
  locationName: string;
  logoUrl: string | null;
  servers: ServerOption[];
}) {
  const [state, formAction, pending] = useActionState(submitSurvey.bind(null, code), initial);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  if (state.ok) {
    return (
      <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-5">
        <div className="max-w-md text-center">
          <div className="text-[44px] mb-3">🙏</div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] mb-2">Thank you!</h1>
          <p className="text-[16px] text-muted leading-relaxed">
            We really appreciate you telling us how it went at {orgName}
            {locationName ? ` (${locationName})` : ""}. It helps us take better care of you next time.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper text-ink py-10 px-5">
      <div className="max-w-[540px] mx-auto">
        <div className="text-center mb-7">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={orgName} className="h-12 w-auto mx-auto mb-4 object-contain" />
          ) : null}
          <h1 className="font-display text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] leading-tight">How was your visit?</h1>
          <p className="text-[15px] text-muted mt-1.5">
            {orgName}
            {locationName ? ` · ${locationName}` : ""} — 20 seconds, and it genuinely helps.
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-5 bg-white border border-line rounded-2xl p-6 shadow-sm">
          {RATING_QUESTIONS.map((q) => (
            <div key={q.id}>
              <label className="text-[14.5px] font-semibold text-ink block mb-2">{q.label}</label>
              <input type="hidden" name={`rating_${q.id}`} value={ratings[q.id] ?? ""} />
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = (ratings[q.id] ?? 0) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      onClick={() => setRatings((r) => ({ ...r, [q.id]: n }))}
                      className={`w-11 h-11 rounded-xl border text-[20px] flex items-center justify-center transition-colors ${
                        active ? "border-gold bg-gold-tint text-gold" : "border-line text-muted-2 hover:border-gold"
                      }`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {servers.length > 0 && (
            <div>
              <label className="text-[14.5px] font-semibold text-ink block mb-2">Who took care of you?</label>
              <select name="server_staff_id" defaultValue="" className="w-full rounded-lg border border-line p-3 text-[15px] bg-white text-ink">
                <option value="">Prefer not to say</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[14.5px] font-semibold text-ink block mb-2">
              Anything you&rsquo;d like to share? <span className="font-normal text-muted-2">(optional)</span>
            </label>
            <textarea
              name="comment"
              rows={4}
              placeholder="What made your visit great — or what we could do better."
              className="w-full rounded-lg border border-line p-3 text-[15px] bg-white text-ink resize-y"
            />
          </div>

          <div>
            <label className="text-[14.5px] font-semibold text-ink block mb-2">
              Email or phone <span className="font-normal text-muted-2">(optional — only if you&rsquo;d like us to follow up)</span>
            </label>
            <input
              name="contact"
              type="text"
              autoComplete="off"
              placeholder="you@email.com or (555) 555-5555"
              className="w-full rounded-lg border border-line p-3 text-[15px] bg-white text-ink"
            />
          </div>

          <HoneypotField />
          <TurnstileWidget />

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <Btn type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send feedback"}
          </Btn>
          <p className="text-[11.5px] text-muted-2 text-center">Your feedback goes straight to the team at {orgName}.</p>
        </form>
      </div>
    </main>
  );
}
