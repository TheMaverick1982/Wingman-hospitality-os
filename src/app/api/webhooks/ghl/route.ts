import { NextResponse, type NextRequest } from "next/server";
import { markBookedByEmail } from "@/lib/crm-sequences";

// Inbound webhook for GoHighLevel booking events. Point your GHL calendar's
// "appointment booked" workflow/webhook at:
//   POST {SITE}/api/webhooks/ghl?token=<GHL_WEBHOOK_SECRET>
// When someone books a call, we mark their CRM contact as booked and stop their
// nurture sequences. Guarded by a shared token if GHL_WEBHOOK_SECRET is set.
export async function POST(request: NextRequest) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (secret) {
    const token = new URL(request.url).searchParams.get("token") ?? request.headers.get("x-webhook-token");
    if (token !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // GHL payloads vary; pull the email from the common shapes.
  const contact = (body.contact ?? {}) as Record<string, unknown>;
  const custom = (body.customData ?? {}) as Record<string, unknown>;
  const email = String(body.email ?? contact.email ?? custom.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true, matched: false, reason: "no email in payload" });

  const matched = await markBookedByEmail(email);
  return NextResponse.json({ ok: true, matched });
}
