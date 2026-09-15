"use client";

import { useActionState, useState, useTransition } from "react";
import { BookUp, Loader2, Check } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import { generateHandbookForRoles, saveHandbookForRoles, type HandbookState, type RoleProgram } from "./role-training-actions";

const initial: HandbookState = { error: null };

// "One handbook -> many roles": upload or paste a single handbook that covers
// several roles, and Wingman splits it into per-role training in one pass. The
// owner reviews each role, unchecks any they don't want, and saves the rest.
export function HandbookImport() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [state, formAction, generating] = useActionState(generateHandbookForRoles, initial);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-brick border border-brick/40 rounded-full px-4 py-2 hover:bg-brick-tint transition-colors"
      >
        <BookUp size={15} /> Import a handbook for all roles
      </button>
      {open && (
        <Modal
          title="Import a handbook across all your roles"
          sub="Upload one handbook or SOP that covers several roles — Wingman splits it into per-role training in one pass. You review each role before anything is saved."
          onClose={() => setOpen(false)}
        >
          {state.programs ? (
            <ReviewStep programs={state.programs} onDone={() => setOpen(false)} />
          ) : (
            <form action={formAction}>
              <input type="hidden" name="mode" value={mode} />
              <div className="flex gap-2 mb-4">
                {(["upload", "paste"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`text-[13px] font-semibold rounded-full px-3.5 py-1.5 border transition-colors ${
                      mode === m ? "border-brick text-white bg-brick" : "border-line text-charcoal-2 hover:border-brick"
                    }`}
                  >
                    {m === "upload" ? "Upload a file" : "Paste text"}
                  </button>
                ))}
              </div>

              {mode === "upload" ? (
                <div>
                  <label className="block text-[13px] font-semibold text-ink mb-1.5">Your handbook (PDF or image)</label>
                  <input type="file" name="file" accept="application/pdf,image/*" className="block w-full text-sm text-charcoal-2 file:mr-3 file:rounded-full file:border-0 file:bg-brick file:px-4 file:py-2 file:text-white file:font-semibold file:text-[13px]" />
                  <p className="text-[12.5px] text-muted-2 mt-2">A text-based PDF works best. 10MB max.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-[13px] font-semibold text-ink mb-1.5">Paste your handbook text</label>
                  <textarea name="pastedText" rows={8} placeholder="Paste the handbook / SOP text that covers your roles…" className={inputClass} />
                </div>
              )}

              {state.error && <p className="text-sm text-brick mt-3">{state.error}</p>}

              <div className="flex justify-end gap-2 mt-5">
                <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
                <Btn type="submit" disabled={generating} icon={generating ? undefined : BookUp}>
                  {generating ? (<><Loader2 size={15} className="animate-spin" /> Reading your handbook…</>) : "Read & split by role"}
                </Btn>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

function ReviewStep({ programs, onDone }: { programs: RoleProgram[]; onDone: () => void }) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(programs.map((p) => [p.department, true])),
  );
  const [saving, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const chosen = programs.filter((p) => selected[p.department]);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveHandbookForRoles(chosen);
      if (res.error) { setMsg(res.error); return; }
      onDone();
    });
  }

  return (
    <div>
      <p className="text-[13px] text-muted mb-3">
        Here&rsquo;s what Wingman pulled for each role. Uncheck any you don&rsquo;t want. Saving replaces each role&rsquo;s
        AI-built items and keeps anything you typed yourself.
      </p>
      <div className="flex flex-col gap-2 max-h-[46vh] overflow-y-auto -mx-1 px-1">
        {programs.map((p) => (
          <label
            key={p.department}
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer ${
              selected[p.department] ? "border-brick bg-brick-tint/40" : "border-line bg-paper"
            }`}
          >
            <input
              type="checkbox"
              checked={!!selected[p.department]}
              onChange={(e) => setSelected((s) => ({ ...s, [p.department]: e.target.checked }))}
              className="accent-brick mt-0.5"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink">{p.department}{p.track_label ? <span className="text-muted-2 font-normal"> · {p.track_label}</span> : null}</div>
              <div className="text-[12.5px] text-muted mt-0.5">
                {p.hospitality_items.length} hospitality · {p.role_items.length} role skill{p.role_items.length === 1 ? "" : "s"}
              </div>
            </div>
          </label>
        ))}
      </div>

      {msg && <p className="text-sm text-brick mt-3">{msg}</p>}
      <div className="flex flex-wrap justify-end gap-2 mt-5">
        <Btn type="button" kind="ghost" onClick={onDone}>Cancel</Btn>
        <Btn type="button" onClick={save} disabled={saving || chosen.length === 0} icon={saving ? undefined : Check}>
          {saving ? (<><Loader2 size={15} className="animate-spin" /> Saving…</>) : `Save to ${chosen.length} role${chosen.length === 1 ? "" : "s"}`}
        </Btn>
      </div>
    </div>
  );
}
