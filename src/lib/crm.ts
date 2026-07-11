// Shared CRM constants and types. Pure (no server-only imports) so both the
// admin server pages and the client board/panel can use it.

export type CrmStage = "new" | "engaged" | "demoed" | "signed_up" | "lost";

export const CRM_STAGES: { key: CrmStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "engaged", label: "Engaged" },
  { key: "demoed", label: "Demo" },
  { key: "signed_up", label: "Signed up" },
  { key: "lost", label: "Lost" },
];

export const CRM_STAGE_KEYS = CRM_STAGES.map((s) => s.key) as CrmStage[];

export function isCrmStage(v: unknown): v is CrmStage {
  return typeof v === "string" && (CRM_STAGE_KEYS as string[]).includes(v);
}

export function stageLabel(stage: string): string {
  return CRM_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

const SOURCE_LABELS: Record<string, string> = {
  demo: "Live demo",
  "sales-chat": "Sales chat",
  calculator: "ROI calculator",
  scorecard: "Scorecard",
  "book-a-demo": "Booked call",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return SOURCE_LABELS[source] ?? source;
}

export type CrmActivityKind = "lead" | "note" | "email_out" | "email_in" | "stage_change" | "system";

// Human-readable result rows from a lead's captured payload (calculator inputs,
// scorecard grade, etc.) — used on the contact timeline and the Leads popup.
export function leadResultRows(source: string | null | undefined, payload: Record<string, unknown> | null | undefined): { label: string; value: string }[] {
  const p = payload || {};
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
  if (source === "calculator") {
    const perYear = num(p.perYear);
    return [
      { label: "New guests / month", value: p.guests != null ? String(p.guests) : "—" },
      { label: "Average check", value: p.check != null ? `$${p.check}` : "—" },
      { label: "Repeat rate", value: `${p.current ?? "?"}% → ${p.target ?? "?"}%` },
      { label: "Visits / year (regular)", value: p.visits != null ? String(p.visits) : "—" },
      { label: "Projected upside", value: perYear != null ? `+$${Math.round(perYear).toLocaleString()}/yr` : "—" },
    ];
  }
  if (source === "scorecard") {
    return [
      { label: "Grade", value: p.grade != null ? String(p.grade) : "—" },
      { label: "Score", value: p.pct != null ? `${p.pct}%` : "—" },
    ];
  }
  return [];
}
