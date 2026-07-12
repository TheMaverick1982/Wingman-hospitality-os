"use client";

import { useActionState, useState } from "react";
import { generateJourney, updateStage, addStage, deleteStage, type JourneyState } from "./actions";

export type Stage = {
  id: string;
  sort_order: number;
  name: string;
  purpose: string;
  avoid: string;
  standard: string;
  script: string;
  inspect: string;
  timing: string;
};

const initial: JourneyState = { error: null };

const STYLES = [
  "Fine dining",
  "Full-service casual dining",
  "Fast-casual",
  "Bar / lounge",
  "Café / coffee shop",
  "Quick-service",
];

function GenerateBar({ hasStages }: { hasStages: boolean }) {
  const [state, action, pending] = useActionState(generateJourney, initial);
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="bg-white border border-line rounded-2xl p-5 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Service style</label>
          <select name="style" defaultValue="Full-service casual dining" disabled={pending} className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-brick disabled:opacity-60">
            {STYLES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          onClick={(e) => {
            if (hasStages && !confirm("Regenerate the whole journey? This replaces your current stages.")) e.preventDefault();
          }}
          className="shrink-0 text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-60"
        >
          {pending ? "Building…" : hasStages ? "Regenerate with AI" : "Generate my journey"}
        </button>
        {state.error && <span className="text-[13px] text-danger self-center">{state.error}</span>}
      </form>

      {pending && (
        <div className="bg-brick-tint/50 border border-brick/20 rounded-2xl p-5 flex items-center gap-3.5">
          <span className="w-5 h-5 rounded-full border-2 border-brick border-t-transparent animate-spin shrink-0" />
          <div>
            <div className="text-[15px] font-semibold text-ink">Mapping your guest experience, moment by moment…</div>
            <div className="text-[13px] text-muted mt-0.5">Hang tight — this takes up to a minute. We&rsquo;re crafting the standards your team will run on every shift.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageCard({ stage, index, canEdit }: { stage: Stage; index: number; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick";
  const lbl = "text-[11.5px] font-semibold uppercase tracking-wide text-muted-2 block mb-1";

  if (editing) {
    return (
      <form
        action={async (fd) => { await updateStage(fd); setEditing(false); }}
        className="bg-white border border-brick/40 rounded-2xl p-5 flex flex-col gap-3"
      >
        <input type="hidden" name="id" value={stage.id} />
        <div className="flex gap-3">
          <div className="flex-1"><label className={lbl}>Stage name</label><input name="name" defaultValue={stage.name} className={field} /></div>
          <div className="w-[200px]"><label className={lbl}>Timing</label><input name="timing" defaultValue={stage.timing} placeholder="e.g. within 10s" className={field} /></div>
        </div>
        <div><label className={lbl}>Why it matters</label><input name="purpose" defaultValue={stage.purpose} className={field} /></div>
        <div><label className={lbl}>Avoid this</label><input name="avoid" defaultValue={stage.avoid} className={field} /></div>
        <div><label className={lbl}>The standard (non-negotiable)</label><input name="standard" defaultValue={stage.standard} className={field} /></div>
        <div><label className={lbl}>Example script / what to do</label><textarea name="script" defaultValue={stage.script} rows={3} className={field} /></div>
        <div><label className={lbl}>What a manager inspects</label><input name="inspect" defaultValue={stage.inspect} className={field} /></div>
        <div className="flex items-center gap-3">
          <button type="submit" className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2 hover:bg-brick-dark transition-colors">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="text-[14px] text-muted-2 hover:text-ink">Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-brick-tint text-brick flex items-center justify-center text-[13px] font-bold shrink-0">{index + 1}</span>
          <div>
            <div className="text-[17px] font-semibold text-ink">{stage.name}</div>
            {stage.purpose && <div className="text-[13.5px] text-muted mt-0.5">{stage.purpose}</div>}
          </div>
        </div>
        {stage.timing && <span className="text-[12px] font-semibold text-charcoal-2 bg-paper rounded-full px-2.5 py-1 shrink-0">{stage.timing}</span>}
      </div>

      <div className="flex flex-col gap-2.5 pl-10">
        {stage.standard && (
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-olive mb-0.5">The standard</div>
            <div className="text-[14px] text-ink">{stage.standard}</div>
          </div>
        )}
        {stage.script && (
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-2 mb-0.5">Say / do</div>
            <div className="text-[14px] text-charcoal-2 italic whitespace-pre-wrap">{stage.script}</div>
          </div>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          {stage.avoid && (
            <div className="flex-1 min-w-[220px]">
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-brick mb-0.5">Avoid</div>
              <div className="text-[13.5px] text-muted">{stage.avoid}</div>
            </div>
          )}
          {stage.inspect && (
            <div className="flex-1 min-w-[220px]">
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-2 mb-0.5">Manager inspects</div>
              <div className="text-[13.5px] text-muted">{stage.inspect}</div>
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3 pl-10 pt-1 border-t border-[#F5F5F5] mt-1">
          <button type="button" onClick={() => setEditing(true)} className="text-[13px] font-semibold text-charcoal-2 hover:text-brick">Edit</button>
          <form action={deleteStage} onSubmit={(e) => { if (!confirm(`Delete "${stage.name}"?`)) e.preventDefault(); }}>
            <input type="hidden" name="id" value={stage.id} />
            <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-danger">Delete</button>
          </form>
        </div>
      )}
    </div>
  );
}

export function JourneyClient({ stages, canEdit }: { stages: Stage[]; canEdit: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      {canEdit && <GenerateBar hasStages={stages.length > 0} />}

      {stages.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted">
          No journey yet.{canEdit ? " Pick your service style above and generate one — then edit any stage to make it yours." : " Ask a manager to set it up."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {stages.map((s, i) => (
            <StageCard key={s.id} stage={s} index={i} canEdit={canEdit} />
          ))}
          {canEdit && (
            <form action={addStage}>
              <button type="submit" className="text-[14px] font-semibold text-charcoal-2 border border-dashed border-line rounded-2xl px-5 py-3 w-full hover:border-brick hover:text-brick transition-colors">
                + Add a stage
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
