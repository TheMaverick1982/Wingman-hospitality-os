import { NextResponse, type NextRequest } from "next/server";
import { markBookedByEmail, markDemoCompletedByEmail, markDemoNoShowByEmail } from "@/lib/crm-sequences";

// Inbound webhook for GoHighLevel booking events. Point your GHL calendar
// workflows/webhooks at:
//   POST {SITE}/api/webhooks/ghl?token=<GHL_WEBHOOK_SECRET>
//
// Routes on the appointment status in the payload:
//   booked / confirmed / new  -> mark booked, stop nurtures, move to Demo Booked
//   showed                    -> move to Demo Completed
//   noshow / no-show          -> tag no-show + start the re-engagement follow-up
// A payload with no status (a plain "appointment booked" webhook) defaults to
// booked, preserving the original behavior. Guarded by a shared token if
// GHL_WEBHOOK_SECRET is set.

function normalizeStatus(raw: unknown): "booked" | "showed" | "noshow" | "cancelled" | "other" {
  const s = String(raw ?? "").trim().toLowerCase().replace(/[\s_-]/g, "");
  if (s === "showed" || s === "show" || s === "attended" || s === "completed") return "showed";
  if (s === "noshow" || s === "missed") return "noshow";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "" || s === "booked" || s === "confirmed" || s === "new" || s === "scheduled") return "booked";
  return "other";
}

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

  // GHL payloads vary; pull the email + appointment status from common shapes.
  const contact = (body.contact ?? {}) as Record<string, unknown>;
  const custom = (body.customData ?? {}) as Record<string, unknown>;
  const appointment = (body.appointment ?? body.calendar ?? {}) as Record<string, unknown>;
  const email = String(body.email ?? contact.email ?? custom.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true, matched: false, reason: "no email in payload" });

  const status = normalizeStatus(
    body.status ?? appointment.status ?? custom.status ?? custom.appointment_status
  );

  let matched = false;
  if (status === "showed") matched = await markDemoCompletedByEmail(email);
  else if (status === "noshow") matched = await markDemoNoShowByEmail(email);
  else if (status === "booked") matched = await markBookedByEmail(email);
  // "cancelled"/"other" are acknowledged but take no CRM action.

  return NextResponse.json({ ok: true, status, matched });
}
