"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  proposeJourney,
  applyJourneyStages,
  refineJourney,
  applyJourneyRefinement,
  refineStage,
  captureFirstTimer,
  logInspection,
  updateStage,
  addStage,
  deleteStage,
  type RefineState,
  type CaptureState,
  type GenerateState,
  type JourneyRefineState,
} from "./actions";

const genInitial: GenerateState = { error: null };
const refineJourneyInitial: JourneyRefineState = { error: null };

export type InspectionStat = { count: number; passed: number };

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

const refineInitial: RefineState = { error: null, ok: false };
const captureInitial: CaptureState = { error: null, ok: false, capturedName: null, nonce: 0 };

// Log a first-time guest straight into Bounce Back from the arrival stage. This
// is the door-side capture the journey's stage 1 calls for — a real write, not
// just a printed standard.
function FirstTimerCapture() {
  const [state, action, pending] = useActionState(captureFirstTimer, captureInitial);

  return (
    <div className="mt-3 rounded-xl border border-brick/30 bg-brick-tint/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[15px]">🛬</span>
        <span className="text-[13.5px] font-semibold text-ink">Log a first-timer</span>
        <span className="text-[12px] text-muted">— catches them into Guest Bounce Back right now</span>
      </div>
      {/* nonce bumps on each success, remounting the inputs so they clear. */}
      <form key={state.nonce} action={action} className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input name="name" required placeholder="Guest name" className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick" />
        <input name="phone" placeholder="Phone (optional)" className="sm:w-[150px] rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick" />
        <input name="email" type="email" placeholder="Email (optional)" className="sm:w-[180px] rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick" />
        <button type="submit" disabled={pending} className="shrink-0 text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2 hover:bg-brick-dark transition-colors disabled:opacity-60">
          {pending ? "Logging…" : "Log"}
        </button>
      </form>
      {state.error && <div className="text-[13px] text-danger mt-2">{state.error}</div>}
      {state.ok && state.capturedName && (
        <div className="text-[13px] text-olive font-semibold mt-2">Logged {state.capturedName} — they&rsquo;re in Bounce Back for visit-2 follow-up.</div>
      )}
    </div>
  );
}

const STYLES = [
  "Fine dining",
  "Full-service casual dining",
  "Fast-casual",
  "Bar / lounge",
  "Café / coffee shop",
  "Quick-service",
];

type PreviewStage = { name: string; purpose?: string; avoid?: string; standard?: string; script?: string; inspect?: string; timing?: string };

// Small read-only preview of a proposed stage.
function StagePreview({ s, index }: { s: PreviewStage; index?: number }) {
  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        {index != null && <span className="w-5 h-5 rounded-full bg-brick-tint text-brick flex items-center justify-center text-[11px] font-bold shrink-0">{index + 1}</span>}
        <span className="text-[14.5px] font-semibold text-ink">{s.name}</span>
        {s.timing && <span className="text-[11px] font-semibold text-charcoal-2 bg-paper rounded-full px-2 py-0.5 ml-auto">{s.timing}</span>}
      </div>
      {s.purpose && <div className="text-[12.5px] text-muted mb-1.5">{s.purpose}</div>}
      {s.standard && <div className="text-[13px] text-ink"><span className="text-[11px] font-semibold uppercase tracking-wide text-olive">Standard </span>{s.standard}</div>}
      {s.script && <div className="text-[13px] text-charcoal-2 italic mt-1">“{s.script}”</div>}
    </div>
  );
}

// Build a journey from a service style + the operator's own description, review
// the AI's recommendation, and approve it before it replaces anything.
function JourneyBuilder({ hasStages }: { hasStages: boolean }) {
  const [state, action, pending] = useActionState(proposeJourney, genInitial);
  const [applying, startApply] = useTransition();
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(!hasStages);
  const preview = state.stages && !dismissed ? state.stages : null;

  function approve() {
    if (!state.stages) return;
    setApplyErr(null);
    startApply(async () => {
      const res = await applyJourneyStages(state.stages!);
      if (res.error) setApplyErr(res.error);
      else setDismissed(true);
    });
  }

  if (hasStages && !open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[13px] font-semibold text-charcoal-2 border border-dashed border-line rounded-2xl px-5 py-3 w-full hover:border-brick hover:text-brick transition-colors">
        ✨ Rebuild the journey from a description
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={action} onSubmit={() => { setDismissed(false); setApplyErr(null); }} className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-[15px] font-semibold text-ink">{hasStages ? "Rebuild your journey" : "Build your guest journey"}</div>
          {hasStages && <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-muted-2 hover:text-ink">Close</button>}
        </div>
        <div>
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Service style</label>
          <select name="style" defaultValue="Full-service casual dining" disabled={pending} className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-brick disabled:opacity-60">
            {STYLES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[13px] font-semibold text-charcoal-2 block mb-1.5">Describe your restaurant &amp; how you want the experience to flow <span className="font-normal text-muted-2">(optional — the more you add, the more it&rsquo;s yours)</span></label>
          <textarea
            name="description"
            rows={4}
            disabled={pending}
            placeholder="e.g. Neighborhood wood-fired pizza spot. We seat at the counter, always offer a taste of a new special, and we walk every first-timer through the menu. Big on remembering regulars' usual drink. End every visit with a fresh cookie on the house."
            className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[14px] text-ink outline-none focus:border-brick disabled:opacity-60 resize-y"
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="shrink-0 text-[15px] font-semibold text-white bg-brick rounded-full px-6 py-2.5 hover:bg-brick-dark transition-colors disabled:opacity-60 inline-flex items-center gap-2">
            {pending && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            {pending ? "Building…" : "Get recommendations"}
          </button>
          {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
        </div>
      </form>

      {pending && (
        <div className="bg-brick-tint/50 border border-brick/20 rounded-2xl p-5 flex items-center gap-3.5">
          <span className="w-5 h-5 rounded-full border-2 border-brick border-t-transparent animate-spin shrink-0" />
          <div>
            <div className="text-[15px] font-semibold text-ink">Mapping your guest experience, moment by moment…</div>
            <div className="text-[13px] text-muted mt-0.5">Hang tight — this takes up to a minute.</div>
          </div>
        </div>
      )}

      {preview && (
        <div className="bg-paper border border-brick/30 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-brick">Recommended journey — review &amp; approve</span>
            <span className="text-[12px] text-muted">{preview.length} stages</span>
          </div>
          {state.summary && <p className="text-[13.5px] text-charcoal-2">{state.summary}</p>}
          <div className="flex flex-col gap-2">
            {preview.map((s, i) => <StagePreview key={i} s={s} index={i} />)}
          </div>
          {hasStages && <p className="text-[12.5px] text-[#B45309]">Approving replaces your current journey.</p>}
          <div className="flex items-center gap-3">
            <button onClick={approve} disabled={applying} className="text-[14px] font-semibold text-white bg-olive rounded-full px-5 py-2 hover:opacity-90 transition-opacity disabled:opacity-60 inline-flex items-center gap-2">
              {applying && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
              {applying ? "Saving…" : hasStages ? "Approve & replace" : "Approve & save"}
            </button>
            <button onClick={() => setDismissed(true)} disabled={applying} className="text-[14px] text-muted-2 hover:text-ink disabled:opacity-60">Discard</button>
            {applyErr && <span className="text-[13px] text-danger">{applyErr}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const JOURNEY_REQUEST_QUICK = ["What am I missing?", "Make the whole thing more upscale", "Add a moment that drives a repeat visit", "Tighten it — fewer stages", "Add an upsell moment"];

// Whole-journey change request: ask in plain English, review the proposed
// add/edit/remove changes, and approve them.
function JourneyRefinePanel() {
  const [state, action, pending] = useActionState(refineJourney, refineJourneyInitial);
  const [applying, startApply] = useTransition();
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const proposal = state.proposal && !dismissed ? state.proposal : null;

  function apply() {
    if (!state.proposal) return;
    setApplyErr(null);
    startApply(async () => {
      const res = await applyJourneyRefinement(state.proposal!);
      if (res.error) setApplyErr(res.error);
      else { setDismissed(true); setOpen(false); }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[14px] font-semibold text-brick border border-dashed border-brick/40 rounded-2xl px-5 py-3 w-full hover:bg-brick-tint/40 transition-colors">
        ✨ Ask AI to improve the journey or request a change
      </button>
    );
  }

  return (
    <div className="bg-white border border-brick/30 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold text-ink">Request a change to your journey</div>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-muted-2 hover:text-ink">Close</button>
      </div>
      <form action={action} onSubmit={() => { setDismissed(false); setApplyErr(null); }} className="flex flex-col gap-2.5">
        <textarea
          name="feedback"
          rows={2}
          disabled={pending}
          placeholder="e.g. Add a wine-pairing moment after the order, and make the goodbye warmer with a reason to come back."
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick disabled:opacity-60 resize-y"
        />
        <div className="flex flex-wrap gap-1.5">
          {JOURNEY_REQUEST_QUICK.map((q) => (
            <button key={q} type="submit" name="feedback" value={q} disabled={pending} className="text-[12px] font-medium text-charcoal-2 bg-paper border border-line rounded-full px-3 py-1 hover:border-brick hover:text-brick transition-colors disabled:opacity-60">
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2 hover:bg-brick-dark transition-colors disabled:opacity-60 inline-flex items-center gap-2">
            {pending && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            {pending ? "Thinking…" : "Get suggestions"}
          </button>
          {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
        </div>
      </form>

      {proposal && (
        <div className="bg-paper border border-line rounded-xl p-4 flex flex-col gap-3">
          <p className="text-[13.5px] font-medium text-ink">{proposal.summary}</p>
          {proposal.add.length > 0 && (
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-olive mb-1.5">Add {proposal.add.length}</div>
              <div className="flex flex-col gap-2">
                {proposal.add.map((c, i) => (
                  <div key={i}>
                    <StagePreview s={c} />
                    {c.reason && <div className="text-[12px] text-muted-2 mt-0.5 pl-1">Why: {c.reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {proposal.edit.length > 0 && (
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-brick mb-1.5">Improve {proposal.edit.length}</div>
              <div className="flex flex-col gap-2">
                {proposal.edit.map((c, i) => (
                  <div key={i}>
                    <StagePreview s={c} />
                    {c.reason && <div className="text-[12px] text-muted-2 mt-0.5 pl-1">Why: {c.reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {proposal.remove.length > 0 && (
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-2 mb-1.5">Remove {proposal.remove.length}</div>
              <div className="flex flex-col gap-1">
                {proposal.remove.map((c, i) => (
                  <div key={i} className="text-[13px] text-charcoal-2">
                    <span className="line-through">{c.name}</span>
                    {c.reason && <span className="text-[12px] text-muted-2"> — {c.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={apply} disabled={applying} className="text-[14px] font-semibold text-white bg-olive rounded-full px-5 py-2 hover:opacity-90 transition-opacity disabled:opacity-60 inline-flex items-center gap-2">
              {applying && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
              {applying ? "Applying…" : "Apply changes"}
            </button>
            <button onClick={() => setDismissed(true)} disabled={applying} className="text-[14px] text-muted-2 hover:text-ink disabled:opacity-60">Discard</button>
            {applyErr && <span className="text-[13px] text-danger">{applyErr}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const REFINE_QUICK = ["Make it warmer", "Make it shorter", "More upscale tone", "Add an upsell", "Make it more specific"];

function RefineBox({ stageId, onClose }: { stageId: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(refineStage, refineInitial);

  // Close the box once the AI has applied the change; the revalidated stage
  // renders with the new copy underneath.
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <form action={action} className="pl-10 pt-1 border-t border-[#F5F5F5] mt-1 flex flex-col gap-2.5">
      <input type="hidden" name="id" value={stageId} />
      <label className="text-[11.5px] font-semibold uppercase tracking-wide text-brick block">Ask AI to revise this stage</label>
      <textarea
        name="feedback"
        rows={2}
        disabled={pending}
        autoFocus
        placeholder="e.g. Warmer and more personal, and mention our house margarita by name."
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brick disabled:opacity-60"
      />
      <div className="flex flex-wrap gap-1.5">
        {REFINE_QUICK.map((q) => (
          <button
            key={q}
            type="submit"
            name="feedback"
            value={q}
            disabled={pending}
            className="text-[12px] font-medium text-charcoal-2 bg-paper border border-line rounded-full px-3 py-1 hover:border-brick hover:text-brick transition-colors disabled:opacity-60"
          >
            {q}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="text-[14px] font-semibold text-white bg-brick rounded-full px-5 py-2 hover:bg-brick-dark transition-colors disabled:opacity-60 inline-flex items-center gap-2"
        >
          {pending && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {pending ? "Revising…" : "Apply with AI"}
        </button>
        <button type="button" onClick={onClose} disabled={pending} className="text-[14px] text-muted-2 hover:text-ink disabled:opacity-60">Cancel</button>
        {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

// Shows how often this stage's inspect standard was met over the last 30 days,
// and (for managers) a one-tap Met / Missed logger — turning the inspect line
// from decorative prose into a live pass-rate metric.
function InspectionRow({ stageId, stat, canEdit }: { stageId: string; stat: InspectionStat | undefined; canEdit: boolean }) {
  const count = stat?.count ?? 0;
  const pct = count > 0 ? Math.round(((stat?.passed ?? 0) / count) * 100) : 0;
  const tone = pct >= 80 ? "text-olive" : pct >= 50 ? "text-[#B45309]" : "text-brick";

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      {count > 0 ? (
        <span className="text-[12px] text-muted-2">
          Inspected {count}× (30d) · <span className={`font-semibold ${tone}`}>{pct}% met</span>
        </span>
      ) : (
        <span className="text-[12px] text-muted-2">Not inspected yet</span>
      )}
      {canEdit && (
        <span className="flex items-center gap-1.5">
          <form action={logInspection}>
            <input type="hidden" name="stageId" value={stageId} />
            <input type="hidden" name="passed" value="true" />
            <button type="submit" className="text-[12px] font-semibold text-olive border border-olive/30 rounded-full px-2.5 py-0.5 hover:bg-olive-tint transition-colors">✓ Met</button>
          </form>
          <form action={logInspection}>
            <input type="hidden" name="stageId" value={stageId} />
            <input type="hidden" name="passed" value="false" />
            <button type="submit" className="text-[12px] font-semibold text-brick border border-brick/30 rounded-full px-2.5 py-0.5 hover:bg-brick-tint transition-colors">✗ Missed</button>
          </form>
        </span>
      )}
    </div>
  );
}

function StageCard({ stage, index, canEdit, showCapture, stat }: { stage: Stage; index: number; canEdit: boolean; showCapture: boolean; stat: InspectionStat | undefined }) {
  const [editing, setEditing] = useState(false);
  const [refining, setRefining] = useState(false);
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
              <InspectionRow stageId={stage.id} stat={stat} canEdit={canEdit} />
            </div>
          )}
        </div>
      </div>

      {canEdit && !refining && (
        <div className="flex items-center gap-3 pl-10 pt-1 border-t border-[#F5F5F5] mt-1">
          <button type="button" onClick={() => setRefining(true)} className="text-[13px] font-semibold text-brick hover:text-brick-dark">✨ Refine with AI</button>
          <button type="button" onClick={() => setEditing(true)} className="text-[13px] font-semibold text-charcoal-2 hover:text-brick">Edit</button>
          <form action={deleteStage} onSubmit={(e) => { if (!confirm(`Delete "${stage.name}"?`)) e.preventDefault(); }}>
            <input type="hidden" name="id" value={stage.id} />
            <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-danger">Delete</button>
          </form>
        </div>
      )}
      {canEdit && refining && <RefineBox stageId={stage.id} onClose={() => setRefining(false)} />}

      {showCapture && <FirstTimerCapture />}
    </div>
  );
}

export function JourneyClient({ stages, canEdit, canCapture, inspections }: { stages: Stage[]; canEdit: boolean; canCapture: boolean; inspections: Record<string, InspectionStat> }) {
  return (
    <div className="flex flex-col gap-5">
      {canEdit && <JourneyBuilder hasStages={stages.length > 0} />}

      {stages.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted">
          No journey yet.{canEdit ? " Describe your restaurant above and Wingman will recommend a journey for you to approve — then edit any stage to make it yours." : " Ask a manager to set it up."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {stages.map((s, i) => (
            <StageCard key={s.id} stage={s} index={i} canEdit={canEdit} showCapture={canCapture && i === 0} stat={inspections[s.id]} />
          ))}
          {canEdit && (
            <>
              <JourneyRefinePanel />
              <form action={addStage}>
                <button type="submit" className="text-[14px] font-semibold text-charcoal-2 border border-dashed border-line rounded-2xl px-5 py-3 w-full hover:border-brick hover:text-brick transition-colors">
                  + Add a blank stage manually
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
