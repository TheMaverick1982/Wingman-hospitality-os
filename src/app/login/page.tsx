"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-semibold mb-6">Log in to Wingman</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">Email</span>
          <input
            name="email"
            type="email"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">Password</span>
          <input
            name="password"
            type="password"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 text-white text-sm font-semibold py-2.5 disabled:opacity-50"
        >
          {pending ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="text-sm text-zinc-600 mt-4">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-zinc-900">
          Set up your organization
        </Link>
      </p>
    </div>
  );
}
