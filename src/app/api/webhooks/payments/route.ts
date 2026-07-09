import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markPastDue, markActive, markCanceled } from "@/lib/billing";

// ---------------------------------------------------------------------------
// PROCESSOR-AGNOSTIC PAYMENT WEBHOOK (stub).
//
// When the payment processor is connected (Global Payments / Genius, Stripe,
// etc.), point its webhook at this endpoint and fill in the two TODOs:
//   1. Verify the provider's signature instead of the shared-secret check.
//   2. Map the provider's payload -> { type, orgId, orgName, card }.
// The state transitions (markPastDue / markActive / markCanceled) and the
// downstream dunning emails + 30-day closure are already wired.
//
// Until then this accepts a normalized internal shape so the whole pipeline is
// testable end-to-end (e.g. POST {type:"payment_failed", orgId, orgName}).
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
  // TODO(provider): replace with the processor's real signature verification.
  if (!secret || request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = (await request.json().catch(() => null)) as {
    type?: string;
    orgId?: string;
    orgName?: string;
    card?: { brand?: string; last4?: string; periodEnd?: string };
  } | null;

  if (!event || typeof event !== "object") return NextResponse.json({ error: "Bad payload" }, { status: 400 });

  // TODO(provider): the provider identifies the account by its own customer id.
  // Look up the org by provider_customer_id and derive orgId/orgName here.
  const { type, orgId, orgName, card } = event;
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const admin = createAdminClient();
  switch (type) {
    case "payment_failed":
      await markPastDue(admin, orgId, orgName ?? "your organization");
      break;
    case "payment_succeeded":
      await markActive(admin, orgId, card);
      break;
    case "subscription_canceled":
      await markCanceled(admin, orgId);
      break;
    default:
      return NextResponse.json({ ignored: type ?? "unknown" });
  }

  return NextResponse.json({ ok: true });
}
