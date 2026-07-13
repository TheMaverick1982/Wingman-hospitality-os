"use client";

import { useActionState, useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { createApiKey, revokeApiKey, type ApiKeyRow, type CreateApiKeyState } from "./api-actions";

const initialState: CreateApiKeyState = { error: null };

type LocationOption = { id: string; name: string };

export function ApiKeysManager({ keys, locations }: { keys: ApiKeyRow[]; locations: LocationOption[] }) {
  const [state, formAction, pending] = useActionState(createApiKey, initialState);
  const [copied, setCopied] = useState(false);
  const newKey = state.plaintext;
  const multiLocation = locations.length > 1;
  const locationName = (id: string | null) => (id ? locations.find((l) => l.id === id)?.name ?? "a location" : null);

  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink mb-1">API access</h3>
          <p className="text-sm text-muted">
            Create a key to connect Wingman to your POS or a Zapier automation — for example, to
            auto-populate your Revenue Growth Planner each week. Keys are only visible to Super Admins.
          </p>
        </div>
        <a
          href="/api-guide"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-line text-sm font-semibold text-ink px-3 py-2 hover:bg-paper"
        >
          <FileText size={15} /> Developer guide
        </a>
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

      <form action={formAction} className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-muted-2 mb-1">Key name</label>
          <input name="name" placeholder="e.g. Toast POS — weekly growth sync" className={inputClass} />
        </div>
        {multiLocation && (
          <div className="min-w-[180px]">
            <label className="block text-xs font-semibold text-muted-2 mb-1">Location</label>
            <select name="locationId" defaultValue="" className={inputClass}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Btn type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create key"}
        </Btn>
      </form>
      {multiLocation && (
        <p className="-mt-3 text-xs text-muted-2">
          Bind a key to one location (the POS at that store) so everything it sends and reads is scoped to it. Leave on
          &ldquo;All locations&rdquo; for a central key — it can still target a store per request with the
          <code className="mx-1 bg-paper border border-line rounded px-1">X-Wingman-Location</code> header.
        </p>
      )}
      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-2 mb-2">Your keys</p>
        {keys.length === 0 ? (
          <p className="text-sm text-muted">No API keys yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line border border-line rounded-lg">
            {keys.map((k) => (
              <KeyRow key={k.id} k={k} locationLabel={locationName(k.location_id)} />
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

function KeyRow({ k, locationLabel }: { k: ApiKeyRow; locationLabel: string | null }) {
  const [revoking, startRevoke] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const revoked = Boolean(k.revoked_at);

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink truncate flex items-center gap-2">
          {k.name} {revoked && <span className="text-xs text-muted-2">(revoked)</span>}
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-paper border border-line text-muted shrink-0">
            {locationLabel ?? "All locations"}
          </span>
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
