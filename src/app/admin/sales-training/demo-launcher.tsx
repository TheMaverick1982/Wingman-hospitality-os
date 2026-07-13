"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { stageLabel } from "@/lib/crm";
import type { DemoTarget } from "@/lib/sales-reps";
import { enterDemoAsStaff } from "./actions";

type Mode = "existing" | "new" | "none";

// "Run a live demo" — but first, name who it's for so the demo ties back to the
// CRM (rep becomes the lead owner, contact advances to Demo Completed). Reps can
// also just explore untied.
export function DemoLauncher({ targets }: { targets: DemoTarget[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(targets.length ? "existing" : "new");
  const [selected, setSelected] = useState<string>("");
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? targets.filter((t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q))
    : targets;

  const canStart =
    mode === "none" ||
    (mode === "existing" && !!selected) ||
    (mode === "new" && /.+@.+\..+/.test(newEmail.trim()));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors"
      >
        ▶ Run a live demo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[19px] font-bold text-ink">Who&rsquo;s this demo for?</h2>
            <p className="text-[13px] text-muted mt-1 mb-4">
              Naming the prospect ties them to you as the lead owner and moves them to Demo Completed in the CRM.
            </p>

            <div className="flex gap-1.5 mb-4">
              {(
                [
                  ["existing", "Existing lead"],
                  ["new", "New prospect"],
                  ["none", "Just exploring"],
                ] as [Mode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 text-[12.5px] font-semibold rounded-lg px-2 py-2 border transition-colors ${
                    mode === m ? "bg-charcoal text-white border-charcoal" : "bg-paper text-ink border-line hover:bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "existing" && (
              <div>
                {targets.length === 0 ? (
                  <p className="text-[13px] text-muted py-6 text-center">
                    No open leads assigned to you yet. Add a new prospect instead.
                  </p>
                ) : (
                  <>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name or email"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2 mb-2 focus:outline-none focus:border-brick"
                    />
                    <div className="border border-line rounded-lg divide-y divide-[#F5F5F5] max-h-56 overflow-y-auto">
                      {filtered.length === 0 && <div className="text-[13px] text-muted px-3 py-4 text-center">No matches.</div>}
                      {filtered.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelected(t.id)}
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 ${
                            selected === t.id ? "bg-brick-tint" : "hover:bg-paper"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold text-ink truncate">{t.name}</span>
                            <span className="block text-[12px] text-muted-2 truncate">{t.email}</span>
                          </span>
                          <span className="text-[11px] font-semibold text-muted shrink-0">{stageLabel(t.stage)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {mode === "new" && (
              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="text-[12.5px] font-semibold text-charcoal-2">Prospect / restaurant name</span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. The Copper Fork"
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 mt-1 focus:outline-none focus:border-brick"
                  />
                </label>
                <label className="block">
                  <span className="text-[12.5px] font-semibold text-charcoal-2">Email</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="owner@restaurant.com"
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 mt-1 focus:outline-none focus:border-brick"
                  />
                </label>
                <p className="text-[12px] text-muted-2">We&rsquo;ll create this contact in your pipeline, assigned to you.</p>
              </div>
            )}

            {mode === "none" && (
              <p className="text-[13px] text-muted py-4">
                Runs a fresh demo without tying it to a contact — good for practice or a quick look. Nothing is saved to the CRM.
              </p>
            )}

            <form action={enterDemoAsStaff} className="mt-5 flex items-center justify-end gap-3">
              <input type="hidden" name="target_kind" value={mode} />
              {mode === "existing" && <input type="hidden" name="contact_id" value={selected} />}
              {mode === "new" && (
                <>
                  <input type="hidden" name="new_name" value={newName} />
                  <input type="hidden" name="new_email" value={newEmail} />
                </>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[13.5px] font-semibold text-ink px-4 py-2.5 rounded-full hover:bg-paper"
              >
                Cancel
              </button>
              <StartButton disabled={!canStart} />
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function StartButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="text-[13.5px] font-semibold text-white bg-brick rounded-full px-5 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {pending ? (
        <>
          <Loader2 size={14} className="animate-spin" /> Starting…
        </>
      ) : (
        "▶ Start demo"
      )}
    </button>
  );
}
