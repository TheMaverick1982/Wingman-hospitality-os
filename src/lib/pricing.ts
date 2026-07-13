import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

// Single source of truth for what an organization pays per month.
// Standard: first location + each additional. The dollar amounts are set by
// platform staff (Admin → Billing → Plan pricing) and stored in the
// platform_pricing table; the constants below are the seed/fallback defaults.

export const BASE_CENTS = 39900; // $399 first location (fallback default)
export const ADDL_CENTS = 14900; // $149 each additional location (fallback default)

export type PlatformPricing = { firstCents: number; addlCents: number };

// Read the platform-wide pricing once per request (cached). Falls back to the
// constants if the row/table isn't there yet, so nothing breaks pre-migration.
export const getPlatformPricing = cache(async (): Promise<PlatformPricing> => {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("platform_pricing").select("first_location_cents, addl_location_cents").maybeSingle();
    const row = data as { first_location_cents: number; addl_location_cents: number } | null;
    if (row) return { firstCents: row.first_location_cents, addlCents: row.addl_location_cents };
  } catch {
    /* fall through to defaults */
  }
  return { firstCents: BASE_CENTS, addlCents: ADDL_CENTS };
});

export type PricingOverrides = {
  custom_monthly_cents?: number | null;
  custom_addl_location_cents?: number | null;
};

// Pure calculation given explicit rates (used by callers that already have the
// platform pricing in hand).
export function monthlyCentsFor(pricing: PlatformPricing, overrides: PricingOverrides | null | undefined, locations: number): number {
  const n = Math.max(1, locations);
  if (overrides?.custom_monthly_cents != null) return overrides.custom_monthly_cents;
  const addl = overrides?.custom_addl_location_cents ?? pricing.addlCents;
  return pricing.firstCents + addl * (n - 1);
}

// The effective monthly price in cents, reading the current platform pricing.
export async function effectiveMonthlyCents(overrides: PricingOverrides | null | undefined, locations: number): Promise<number> {
  const pricing = await getPlatformPricing();
  return monthlyCentsFor(pricing, overrides, locations);
}

// A short human label describing which pricing an org is on.
export function pricingLabel(overrides: PricingOverrides | null | undefined): "standard" | "flat" | "custom-per-location" {
  if (overrides?.custom_monthly_cents != null) return "flat";
  if (overrides?.custom_addl_location_cents != null) return "custom-per-location";
  return "standard";
}

// Format cents as a whole-dollar string ("$399"). Prices are always whole
// dollars today, so no decimals.
export function dollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

// Substitute price tokens in static copy (Help, sales playbook, emails) so the
// docs show the live configured price. Supported: {{firstPrice}}, {{addlPrice}}.
export function applyPriceTokens(text: string, pricing: PlatformPricing): string {
  return text
    .replaceAll("{{firstPrice}}", dollars(pricing.firstCents))
    .replaceAll("{{addlPrice}}", dollars(pricing.addlCents));
}
