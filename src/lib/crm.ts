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
