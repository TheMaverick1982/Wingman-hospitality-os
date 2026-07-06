"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type SignupState } from "./actions";

const initialState: SignupState = { error: null, checkEmail: false };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.checkEmail) {
    return (
      <div className="mx-auto max-w-sm py-24 text-center">
        <h1 className="text-2xl font-semibold mb-2">Check your email</h1>
        <p className="text-sm text-zinc-600">
          We sent you a confirmation link. Click it to activate your account and set up your
          organization.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-semibold mb-1">Set up Wingman</h1>
      <p className="text-sm text-zinc-600 mb-6">
        You&apos;ll be the General Manager for your organization — you can invite Store Managers
        afterward.
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Restaurant / organization name" name="orgName" placeholder="Square Peg" />
        <Field label="Your first location" name="locationName" placeholder="Delray Beach" />
        <Field label="Your name" name="fullName" placeholder="Jane Doe" />
        <Field label="Email" name="email" type="email" placeholder="you@example.com" />
        <Field label="Password" name="password" type="password" placeholder="At least 8 characters" />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 text-white text-sm font-semibold py-2.5 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create organization"}
        </button>
      </form>
      <p className="text-sm text-zinc-600 mt-4">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-zinc-900">
          Log in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
