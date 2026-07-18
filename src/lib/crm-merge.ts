import "server-only";
import { safeFirstName } from "@/lib/name-safety";

// Merge-field resolver for CRM emails. Supports:
//   {{first_name}} / {{name}}        -> safe first name (or "there")
//   {{contact.<field_key>}}          -> contact.fields[key] (calc_*, scorecard_*, workspace_name, ...)
//   {{calendar.booking_link}}        -> demo booking URL
//   {{calendar.onboarding_link}}     -> onboarding booking URL
// Missing/blank contact fields fall back to a neutral phrase so a sentence never
// renders a bare "$" or "%".

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app";
const BOOKING_LINK = process.env.DEMO_CALENDAR_URL ?? `${SITE}/book-a-demo`;
const ONBOARDING_LINK = process.env.ONBOARDING_CALENDAR_URL ?? BOOKING_LINK;

// Fields formatted as currency ($1,234) when they hold a number.
const CURRENCY_FIELDS = new Set(["calc_annual_upside", "calc_monthly_upside", "calc_avg_check"]);

// Neutral fallbacks so merged sentences still read if a field is missing.
const FALLBACKS: Record<string, string> = {
  calc_annual_upside: "a meaningful number",
  calc_monthly_upside: "real money",
  calc_current_repeat_rate: "where it is",
  calc_target_repeat_rate: "your target",
  calc_avg_check: "your average check",
  calc_new_guests_month: "your new guests",
  scorecard_score: "your score",
  scorecard_gap_1: "your biggest gap",
  scorecard_gap_2: "your next gap",
  scorecard_gap_3: "another gap",
  workspace_name: "your workspace",
};

function formatField(key: string, raw: unknown): string {
  if (raw == null || raw === "") return FALLBACKS[key] ?? "";
  if (CURRENCY_FIELDS.has(key)) {
    const n = Number(raw);
    if (Number.isFinite(n)) return `$${Math.round(n).toLocaleString()}`;
  }
  return String(raw);
}

export type MergeContact = { name?: string | null; fields?: Record<string, unknown> | null };

export function renderMerge(text: string, contact: MergeContact): string {
  const first = safeFirstName(contact.name) ?? "there";
  const fields = contact.fields ?? {};
  // Assigned rep (the salesperson who hosted the booking) — captured on the
  // contact at booking time. Falls back to a neutral team signature so demo
  // emails never render a blank name.
  const repName = (typeof fields.rep_name === "string" && fields.rep_name.trim()) || "the Wingman team";
  const repFirst = (typeof fields.rep_first_name === "string" && fields.rep_first_name.trim()) || safeFirstName(repName) || "the Wingman team";
  return text
    .replace(/\{\{\s*(first_name|name)\s*\}\}/gi, first)
    .replace(/\{\{\s*rep_first_name\s*\}\}/gi, repFirst)
    .replace(/\{\{\s*rep_name\s*\}\}/gi, repName)
    .replace(/\{\{\s*calendar\.booking_link\s*\}\}/gi, BOOKING_LINK)
    .replace(/\{\{\s*calendar\.onboarding_link\s*\}\}/gi, ONBOARDING_LINK)
    .replace(/\{\{\s*contact\.([a-z0-9_]+)\s*\}\}/gi, (_m, key: string) => {
      if (key === "first_name" || key === "name") return first;
      return formatField(key, (fields as Record<string, unknown>)[key]);
    });
}

export const CRM_REPLY_TO = "hello@joinwingman.app";
