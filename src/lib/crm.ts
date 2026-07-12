// Shared CRM constants and types. Pure (no server-only imports) so both the
// admin server pages and the client board/panel can use it.

export type CrmStage = "new" | "engaged" | "demoed" | "demo_completed" | "signed_up" | "past_client" | "lost";

// Labels track the automation spec's "Wingman Sales" pipeline. Keys are stable
// (existing cards don't move). "past_client" holds churned customers so we can
// win them back with the Reactivation sequence.
export const CRM_STAGES: { key: CrmStage; label: string }[] = [
  { key: "new", label: "New Lead" },
  { key: "engaged", label: "Nurturing" },
  { key: "demoed", label: "Demo Booked" },
  { key: "demo_completed", label: "Demo Completed" },
  { key: "signed_up", label: "Signed Up" },
  { key: "past_client", label: "Past Clients" },
  { key: "lost", label: "Lost / Dormant" },
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
  signup: "Signup onboarding",
  "demo-no-show": "Demo no-show",
  referral: "Referral ask (day 30)",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return SOURCE_LABELS[source] ?? source;
}

export type CrmActivityKind = "lead" | "note" | "email_out" | "email_in" | "stage_change" | "system";

// Map a captured lead's payload into the contact custom fields the emails merge
// ({{contact.calc_annual_upside}}, {{contact.scorecard_gap_1}}, ...). Reads both
// the spec field keys and our current landing-page keys, so it works before and
// after the landing pages are updated to the spec payload.
export function contactFieldsFromLead(source: string, payload: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const p = payload || {};
  const num = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  const f: Record<string, unknown> = { lead_source_page: `/${source}` };
  if (source === "calculator") {
    f.calc_new_guests_month = num(p.new_guests_month ?? p.guests);
    f.calc_avg_check = num(p.avg_check ?? p.check);
    f.calc_current_repeat_rate = num(p.current_repeat_rate ?? p.current);
    f.calc_target_repeat_rate = num(p.target_repeat_rate ?? p.target);
    f.calc_regular_visits_year = num(p.regular_visits_year ?? p.visits);
    const annual = num(p.annual_upside ?? p.perYear);
    if (annual != null) f.calc_annual_upside = annual;
    const monthly = num(p.monthly_upside);
    f.calc_monthly_upside = monthly != null ? monthly : annual != null ? Math.round(annual / 12) : undefined;
  }
  if (source === "scorecard") {
    f.scorecard_score = num(p.score ?? p.pct);
    if (p.gap_1) f.scorecard_gap_1 = p.gap_1;
    if (p.gap_2) f.scorecard_gap_2 = p.gap_2;
    if (p.gap_3) f.scorecard_gap_3 = p.gap_3;
  }
  for (const k of Object.keys(f)) if (f[k] === undefined) delete f[k];
  return f;
}

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
