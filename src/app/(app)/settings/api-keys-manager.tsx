"use client";

import { useActionState, useState, useTransition } from "react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { createApiKey, revokeApiKey, type ApiKeyRow, type CreateApiKeyState } from "./api-actions";

const initialState: CreateApiKeyState = { error: null };

export function ApiKeysManager({ keys }: { keys: ApiKeyRow[] }) {
  const [state, formAction, pending] = useActionState(createApiKey, initialState);
  const [copied, setCopied] = useState(false);
  const newKey = state.plaintext;

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col gap-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink mb-1">API access</h3>
        <p className="text-sm text-muted">
          Create a key to connect Wingman to your POS or a Zapier automation — for example, to
          auto-populate your Revenue Growth Planner each week. Keys are only visible to Super Admins.
        </p>
      </div>

      {newKey && (
        <div className="rounded-lg border border-[#B7E0C4] bg-[#E7F6EC] p-4">
          <p className="text-sm font-semibold text-[#15803d] mb-1">Your new API key — copy it now</p>
          <p className="text-xs text-[#166534] mb-3">
            This is the only time the full key is shown. Store it somewhere safe; if you lose it, revoke it
            and create a new one.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-line rounded-md px-3 py-2 break-all">{newKey}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                setCopied(true);
              }}
              className="text-sm font-semibold text-brick shrink-0"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <form action={formAction} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-muted-2 mb-1">Key name</label>
          <input name="name" placeholder="e.g. Toast POS — weekly growth sync" className={inputClass} />
        </div>
        <Btn type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create key"}
        </Btn>
      </form>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-2 mb-2">Your keys</p>
        {keys.length === 0 ? (
          <p className="text-sm text-muted">No API keys yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line border border-line rounded-lg">
            {keys.map((k) => (
              <KeyRow key={k.id} k={k} />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-2 leading-relaxed border-t border-line pt-4">
        <strong>You&apos;re responsible for keys you create.</strong> An API key can read and write your
        organization&apos;s data. Share it only with developers you trust, never expose it in client-side code
        or public repositories, and revoke it immediately if it may have been exposed.
      </p>
    </div>
  );
}

function KeyRow({ k }: { k: ApiKeyRow }) {
  const [revoking, startRevoke] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const revoked = Boolean(k.revoked_at);

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink truncate">
          {k.name} {revoked && <span className="text-xs text-muted-2">(revoked)</span>}
        </div>
        <div className="text-xs text-muted-2">
          <code>{k.key_prefix}…</code> · created {new Date(k.created_at).toLocaleDateString()}
          {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}` : " · never used"}
        </div>
        {err && <div className="text-xs text-brick mt-1">{err}</div>}
      </div>
      {!revoked && (
        <button
          type="button"
          disabled={revoking}
          onClick={() => {
            if (!window.confirm(`Revoke "${k.name}"? Any integration using it will stop working immediately.`)) return;
            setErr(null);
            startRevoke(async () => {
              const res = await revokeApiKey(k.id);
              if (res.error) setErr(res.error);
            });
          }}
          className="text-sm font-semibold text-brick hover:opacity-70 disabled:opacity-50 shrink-0"
        >
          {revoking ? "Revoking..." : "Revoke"}
        </button>
      )}
    </div>
  );
}
