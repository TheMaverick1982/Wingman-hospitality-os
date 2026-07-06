"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";

const initialState: OnboardingState = { error: null };

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">Restaurant / organization name</span>
        <input name="orgName" required className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">Your first location</span>
        <input name="locationName" required className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">Your name</span>
        <input name="fullName" required className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 text-white text-sm font-semibold py-2.5 disabled:opacity-50"
      >
        {pending ? "Creating..." : "Create organization"}
      </button>
    </form>
  );
}
