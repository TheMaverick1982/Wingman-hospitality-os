"use client";

import { useActionState, useMemo, useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { Field, inputClass } from "@/components/ui/field";
import { StarRating } from "@/components/ui/star-rating";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/ui/status-pill";
import { Pill } from "@/components/ui/pill";
import { DeleteIconButton } from "@/components/ui/delete-icon-button";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Location } from "@/lib/data/locations";
import {
  FIVE_GAPS,
  AUDIT_DOMAINS,
  constraintGapIndex,
  scoreTone,
  type AuditRecord,
} from "@/lib/audit";
import { runAudit, deleteAudit, type ActionState } from "./actions";

const initialState: ActionState = { error: null };
const today = () => new Date().toISOString().slice(0, 10);

/** Renders a compact action-plan string with **bold** and line breaks. */
function ActionPlan({ text }: { text: string }) {
  return (
    <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
      {text.split("\n").map((line, i) => (
        <p key={i} className="mb-1.5 last:mb-0">
          {line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
            seg.startsWith("**") && seg.endsWith("**") ? (
              <strong key={j} className="font-semibold text-brick-dark">
                {seg.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{seg}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}

export function AuditClient({
  audits,
  locations,
  canEdit,
  isSuperAdmin,
  defaultLocationId,
  lockedLocationName,
}: {
  audits: AuditRecord[];
  locations: Location[];
  canEdit: boolean;
  isSuperAdmin: boolean;
  defaultLocationId: string | null;
  lockedLocationName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(runAudit, initialState);
  useCloseOnSuccess(pending, state.error, () => setOpen(false));

  const latest = audits[0];
  const previous = audits[1];
  const locationName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "All locations";

  const constraint = useMemo(
    () => (latest ? FIVE_GAPS[constraintGapIndex(latest.gap_scores)] : null),
    [latest]
  );
  const healthDelta = latest && previous ? latest.health_score - previous.health_score : null;

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Standout Audit</h1>
          <p className="text-base text-muted max-w-2xl">
            One walkthrough, two scores: the <span className="font-semibold text-ink">5-Gap Diagnosis</span> finds the
            one constraint holding you back, and the <span className="font-semibold text-ink">Standout Audit</span>{" "}
            reads the live guest experience across seven domains.
          </p>
        </div>
        {canEdit ? (
          <Btn icon={Plus} onClick={() => setOpen(true)} className="shrink-0">
            Run an audit
          </Btn>
        ) : (
          <Pill>View only</Pill>
        )}
      </div>

      {latest ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatTile
              label="Health Score"
              value={`${latest.health_score}`}
              sub="5-Gap Diagnosis / 100"
              trend={healthDelta !== null ? `${healthDelta >= 0 ? "+" : ""}${healthDelta} vs last` : undefined}
              trendTone={healthDelta === null ? "flat" : healthDelta >= 0 ? "up" : "down"}
            />
            <StatTile label="Audit Score" value={`${latest.audit_score}`} sub="7-domain experience / 100" />
            <StatTile label="Fix this first" value={constraint?.label ?? "—"} sub="your most-open gap" />
            <StatTile label="Audits run" value={audits.length} sub={`latest ${latest.occurred_on}`} />
          </div>

          <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Your action plan</div>
                <div className="text-[13px] text-muted mt-0.5">
                  {locationName(latest.location_id)} · {latest.occurred_on}
                </div>
              </div>
              {constraint && (
                <StatusPill
                  label={`Constraint: ${constraint.label}`}
                  fg="text-brick-dark"
                  bg="bg-brick-tint"
                  dot="bg-brick"
                />
              )}
            </div>
            <ActionPlan text={latest.action_plan || "No action plan recorded."} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
              <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-4">5-Gap Diagnosis</div>
              <div className="flex flex-col gap-3">
                {FIVE_GAPS.map((g, i) => {
                  const pct = (latest.gap_scores[i] / 5) * 100;
                  const tone = scoreTone(pct);
                  return (
                    <div key={g.key}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-medium text-ink">{g.label}</span>
                        <span className={`text-xs font-semibold ${tone.fg}`}>{latest.gap_scores[i]}/5</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F1F1F1] overflow-hidden">
                        <div className={`h-full rounded-full ${tone.dot}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-line rounded-2xl p-7 shadow-sm">
              <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-4">Standout Audit — 7 domains</div>
              <div className="flex flex-col gap-3">
                {AUDIT_DOMAINS.map((d, i) => {
                  const pct = (latest.domain_scores[i] / 5) * 100;
                  const tone = scoreTone(pct);
                  return (
                    <div key={d.key}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-medium text-ink">
                          {d.label} <span className="text-muted-2 text-xs">· wt {d.weight}</span>
                        </span>
                        <span className={`text-xs font-semibold ${tone.fg}`}>{latest.domain_scores[i]}/5</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F1F1F1] overflow-hidden">
                        <div className={`h-full rounded-full ${tone.dot}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {audits.length > 1 && (
            <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-line">
                    {["Date", "Location", "Health", "Audit", "Constraint", ""].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audits.map((a) => (
                    <tr key={a.id} className="border-b border-line last:border-b-0 hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-5 py-3.5 text-ink font-medium">{a.occurred_on}</td>
                      <td className="px-5 py-3.5 text-muted">{locationName(a.location_id)}</td>
                      <td className="px-5 py-3.5 text-ink font-semibold tabular-nums">{a.health_score}</td>
                      <td className="px-5 py-3.5 text-ink font-semibold tabular-nums">{a.audit_score}</td>
                      <td className="px-5 py-3.5 text-muted">{FIVE_GAPS[constraintGapIndex(a.gap_scores)].label}</td>
                      <td className="px-5 py-3.5">{canEdit && <DeleteIconButton id={a.id} action={deleteAudit} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="bg-paper border border-line rounded-2xl p-10 text-center">
          <ClipboardCheck size={28} className="mx-auto text-muted-2 mb-3" />
          <p className="text-sm text-muted">
            No audits yet. {canEdit ? "Run your first walkthrough to get a Health Score and an action plan." : "Ask an owner or manager to run the first audit."}
          </p>
        </div>
      )}

      {open && (
        <Modal
          title="Run an audit"
          sub="Score each line 0–5 from a live, front-to-back walkthrough. Be honest — the plan is only as good as the read."
          onClose={() => setOpen(false)}
          wide
        >
          <form action={formAction}>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <Field label="Location">
                {isSuperAdmin ? (
                  <select name="locationId" defaultValue={defaultLocationId ?? ""} className={inputClass}>
                    <option value="">All locations</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input type="hidden" name="locationId" value={defaultLocationId ?? ""} />
                    <input disabled value={lockedLocationName ?? ""} className={`${inputClass} opacity-70`} />
                  </>
                )}
              </Field>
              <Field label="Date">
                <input type="date" name="occurredOn" defaultValue={today()} required className={inputClass} />
              </Field>
            </div>

            <div className="mb-2 text-sm font-semibold text-ink">5-Gap Diagnosis</div>
            <div className="text-xs text-muted mb-3">Rate how well each is handled today. Low scores flag your constraint.</div>
            <div className="flex flex-col gap-3 mb-6">
              {FIVE_GAPS.map((g, i) => (
                <div key={g.key} className="flex items-center justify-between gap-4 bg-panel border border-line rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">{g.label}</div>
                    <div className="text-xs text-muted truncate">{g.question}</div>
                  </div>
                  <StarRating name={`gap_${i}`} />
                </div>
              ))}
            </div>

            <div className="mb-2 text-sm font-semibold text-ink">Standout Audit — 7 domains</div>
            <div className="text-xs text-muted mb-3">Score the live guest experience you just walked.</div>
            <div className="flex flex-col gap-3 mb-6">
              {AUDIT_DOMAINS.map((d, i) => (
                <div key={d.key} className="flex items-center justify-between gap-4 bg-panel border border-line rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">
                      {d.label} <span className="text-muted-2 text-xs">· weight {d.weight}</span>
                    </div>
                    <div className="text-xs text-muted truncate">{d.hint}</div>
                  </div>
                  <StarRating name={`domain_${i}`} />
                </div>
              ))}
            </div>

            <Field label="Concept (optional — sharpens the AI plan)">
              <input name="concept" placeholder="e.g. Neighborhood Italian, $$" className={inputClass} />
            </Field>

            {state.error && <p className="text-sm text-danger mb-2">{state.error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" loading={pending}>
                {pending ? "Scoring & writing your plan..." : "Save audit & get plan"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
