"use client";

import { useActionState, useState } from "react";
import { updateAffiliateSettings, type PayoutState } from "./actions";

const initial: PayoutState = { error: null, ok: false };
const field =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink placeholder:text-muted-2 outline-none focus:border-brick transition-colors";

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input readOnly value={link} className={`${field} font-mono text-[13px] flex-1`} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-[14px] font-semibold text-white bg-brick rounded-xl px-4 py-3 hover:bg-brick-dark transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export function SettingsForm({
  paypalEmail,
  cookieDays,
  defaultCookieDays,
}: {
  paypalEmail: string;
  cookieDays: number | null;
  defaultCookieDays: number;
}) {
  const [state, action, pending] = useActionState(updateAffiliateSettings, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="block text-[13px] font-semibold text-ink mb-1.5">PayPal email (where we send payouts)</label>
        <input name="paypalEmail" type="email" defaultValue={paypalEmail} placeholder="you@example.com" className={field} />
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-ink mb-1.5">
          Attribution window <span className="font-normal text-muted-2">(days a referral stays credited to you)</span>
        </label>
        <input
          name="cookieDays"
          type="number"
          min={1}
          max={365}
          defaultValue={cookieDays ?? ""}
          placeholder={`Default (${defaultCookieDays} days)`}
          className={field}
        />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && !state.error && <p className="text-sm text-olive font-semibold">Saved.</p>}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-3 hover:bg-brick-dark transition-colors disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
