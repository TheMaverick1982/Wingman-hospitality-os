"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, SlidersHorizontal } from "lucide-react";
import type { Department } from "@/lib/constants";
import { addRole, removeRole } from "./roles-actions";

// Shared across Training and Hiring: shows the roles this restaurant runs and
// lets the owner add one (from the built-ins they don't have yet) or remove one
// they don't. Removing only hides it — the content is kept and can be re-added.
export function RoleManager({
  active,
  inactive,
  canManage,
  noun = "role",
}: {
  active: Department[];
  inactive: Department[];
  canManage: boolean;
  noun?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doAdd = (d: Department) =>
    start(async () => {
      setError(null);
      const res = await addRole(d);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  const doRemove = (d: Department) => {
    if (!window.confirm(`Remove the ${d} ${noun}? Its content is kept — you can add it back anytime.`)) return;
    start(async () => {
      setError(null);
      const res = await removeRole(d);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="bg-white border border-line rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-muted mr-1">Your roles:</span>
          {active.map((d) => (
            <span key={d} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink bg-paper border border-line rounded-full pl-3 pr-2 py-1">
              {d}
              {canManage && editing && (
                <button
                  type="button"
                  onClick={() => doRemove(d)}
                  disabled={pending}
                  className="text-muted-2 hover:text-brick transition-colors disabled:opacity-40"
                  aria-label={`Remove ${d}`}
                >
                  <X size={13} />
                </button>
              )}
            </span>
          ))}
          {active.length === 0 && <span className="text-[13px] text-muted-2">None yet — add the roles you have.</span>}
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick transition-colors"
          >
            <SlidersHorizontal size={14} /> {editing ? "Done" : "Manage roles"}
          </button>
        )}
      </div>

      {canManage && editing && (
        <div className="mt-4 pt-4 border-t border-[#F5F5F5]">
          {inactive.length > 0 ? (
            <>
              <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-2 mb-2">Add a role you have</div>
              <div className="flex flex-wrap gap-2">
                {inactive.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => doAdd(d)}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 bg-paper border border-line rounded-full px-3 py-1.5 hover:border-brick hover:text-brick transition-colors disabled:opacity-40"
                  >
                    {pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {d}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-muted-2 mt-2.5">
                Adding a role fills it with starter standards, duties, and interview questions you can then tailor with AI.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted">You&rsquo;ve added every built-in role. Remove any you don&rsquo;t run with the ✕ on its chip.</p>
          )}
          {error && <p className="text-[12.5px] text-brick-dark mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
