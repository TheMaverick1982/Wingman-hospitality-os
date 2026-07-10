import "server-only";

// Single source of truth for what an organization pays per month.
// Standard: $199 for the first location + $100 for each additional. Two optional
// per-org overrides (set by platform staff) take precedence.

export const BASE_CENTS = 19900; // $199 first location
export const ADDL_CENTS = 10000; // $100 each additional location

export type PricingOverrides = {
  custom_monthly_cents?: number | null;
  custom_addl_location_cents?: number | null;
};

// The effective monthly price in cents for an org with `locations` locations.
export function effectiveMonthlyCents(overrides: PricingOverrides | null | undefined, locations: number): number {
  const n = Math.max(1, locations);
  if (overrides?.custom_monthly_cents != null) return overrides.custom_monthly_cents;
  const addl = overrides?.custom_addl_location_cents ?? ADDL_CENTS;
  return BASE_CENTS + addl * (n - 1);
}

// A short human label describing which pricing an org is on.
export function pricingLabel(overrides: PricingOverrides | null | undefined): "standard" | "flat" | "custom-per-location" {
  if (overrides?.custom_monthly_cents != null) return "flat";
  if (overrides?.custom_addl_location_cents != null) return "custom-per-location";
  return "standard";
}
