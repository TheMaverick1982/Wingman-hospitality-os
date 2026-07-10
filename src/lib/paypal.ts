import "server-only";

// -----------------------------------------------------------------------------
// Minimal PayPal Payouts client. Uses client-credentials OAuth against the
// sandbox or live API depending on PAYPAL_ENV. Money out only (affiliate
// payouts) — nothing here touches customer billing (that's Global Payments).
// -----------------------------------------------------------------------------

function base(): string {
  return (process.env.PAYPAL_ENV ?? "sandbox") === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function accessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal is not configured (missing PAYPAL_CLIENT_ID/SECRET).");

  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PayPal auth failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("PayPal auth returned no token.");
  return data.access_token;
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Send a single-recipient payout. senderBatchId must be unique per attempt (we
// use the payout row id) so retries don't double-send. Returns PayPal's batch id.
export async function createPayout(opts: {
  senderBatchId: string;
  receiverEmail: string;
  amountCents: number;
  note?: string;
}): Promise<{ batchId: string; status: string }> {
  const token = await accessToken();
  const res = await fetch(`${base()}/v1/payments/payouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: opts.senderBatchId,
        email_subject: "You have a Wingman affiliate payout",
        email_message: "Thanks for partnering with Wingman — here's your commission payout.",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: dollars(opts.amountCents), currency: "USD" },
          receiver: opts.receiverEmail,
          note: opts.note ?? "Wingman affiliate commission",
          sender_item_id: opts.senderBatchId,
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PayPal payout failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { batch_header?: { payout_batch_id?: string; batch_status?: string } };
  const batchId = data.batch_header?.payout_batch_id;
  if (!batchId) throw new Error("PayPal payout returned no batch id.");
  return { batchId, status: data.batch_header?.batch_status ?? "PENDING" };
}

export type PayoutState = { batchStatus: string; itemStatus: string | null };

// Poll a payout batch to reconcile final status.
export async function getPayoutStatus(batchId: string): Promise<PayoutState> {
  const token = await accessToken();
  const res = await fetch(`${base()}/v1/payments/payouts/${batchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PayPal status check failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    batch_header?: { batch_status?: string };
    items?: { transaction_status?: string }[];
  };
  return {
    batchStatus: data.batch_header?.batch_status ?? "UNKNOWN",
    itemStatus: data.items?.[0]?.transaction_status ?? null,
  };
}
