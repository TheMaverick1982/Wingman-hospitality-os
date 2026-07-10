// Human label + tone for an org's billing state, from the two signals:
//   is_free_account – explicitly comped (free forever)
//   billing_status  – free (no plan yet) / active / past_due / canceled
// Pure (no server-only) so both server and client components can use it.

export type BillingTone = "olive" | "brick" | "gold" | "muted";
export type BillingBadge = { label: string; tone: BillingTone };

export function billingBadge(isFree: boolean, status: string): BillingBadge {
  if (isFree) return { label: "Free (comped)", tone: "olive" };
  switch (status) {
    case "active":
      return { label: "Paid · active", tone: "brick" };
    case "past_due":
      return { label: "Past due", tone: "gold" };
    case "canceled":
      return { label: "Canceled", tone: "muted" };
    default:
      return { label: "No plan yet", tone: "muted" };
  }
}

export const BILLING_TONE_CLASSES: Record<BillingTone, string> = {
  olive: "text-olive bg-olive-tint",
  brick: "text-brick bg-brick-tint",
  gold: "text-gold bg-gold-tint",
  muted: "text-muted bg-paper",
};
