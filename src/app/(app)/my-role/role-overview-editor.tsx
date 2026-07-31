"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check } from "lucide-react";
import { generateRoleOverview, saveRoleOverview } from "../role-overview-actions";

// Manager-only inline editor for a role's overview, shown on the role-guide
// preview. Generate a draft with AI (grounded in the role's standards/duties),
// edit it, and save — it then shows to every staff member in that role.
export function RoleOverviewEditor({ department, initial }: { department: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [savedText, setSavedText] = useState(initial);
  const [genPending, startGen] = useTransition();
  const [savePending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = text.trim() !== savedText.trim();

  function generate() {
    setError(null);
    setJustSaved(false);
    startGen(async () => {
      const res = await generateRoleOverview(department);
      if (res.error) setError(res.error);
      else if (res.overview) setText(res.overview);
    });
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await saveRoleOverview(department, text);
      if (res.error) setError(res.error);
      else {
        setSavedText(res.overview ?? text.trim());
        setJustSaved(true);
      }
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="text-[13px] font-semibold text-ink">
          Role overview <span className="font-normal text-muted-2">— shown to staff at the top of this guide</span>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={genPending}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick border border-brick/40 rounded-full px-3 py-1.5 hover:bg-brick-tint disabled:opacity-50"
        >
          <Sparkles size={13} /> {genPending ? "Writing…" : text.trim() ? "Rewrite with AI" : "Generate with AI"}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setJustSaved(false);
        }}
        rows={3}
        placeholder="A short, motivating summary of what this role is about — or tap Generate with AI to draft one."
        className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14.5px] leading-[1.5] text-ink outline-none focus:border-brick resize-y"
      />
      <div className="flex items-center gap-3 mt-2.5">
        <button
          type="button"
          onClick={save}
          disabled={savePending || !dirty}
          className="text-[13px] font-semibold text-white bg-brick rounded-full px-4 py-2 hover:bg-brick-dark disabled:opacity-50"
        >
          {savePending ? "Saving…" : "Save overview"}
        </button>
        {justSaved && !dirty && (
          <span className="text-[13px] text-olive font-semibold inline-flex items-center gap-1">
            <Check size={13} /> Saved
          </span>
        )}
        {error && <span className="text-[13px] text-danger">{error}</span>}
      </div>
    </div>
  );
}
