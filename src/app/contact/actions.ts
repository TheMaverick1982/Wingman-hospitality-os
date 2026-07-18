"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isHoneypotFilled } from "@/lib/honeypot";
import { sendEmail } from "@/lib/email";
import { BILLING_OWNER_EMAIL } from "@/lib/billing";
import { SMS_CONSENT_VERSION, TRANSACTIONAL_CONSENT, MARKETING_CONSENT } from "./consent";

export type ContactState = { error: string | null; ok: boolean };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

export async function submitContact(input: {
  name: string;
  email: string;
  phone: string;
  message: string;
  optInTransactional: boolean;
  optInMarketing: boolean;
  hp?: string;
}): Promise<ContactState> {
  // Naive spam bot filled the hidden honeypot — pretend success, store nothing.
  if (isHoneypotFilled(input.hp)) return { error: null, ok: true };

  const name = String(input.name || "").trim().slice(0, 120);
  const email = String(input.email || "").trim().toLowerCase().slice(0, 200);
  const phone = String(input.phone || "").trim().slice(0, 40);
  const message = String(input.message || "").trim().slice(0, 4000);
  const optInTransactional = Boolean(input.optInTransactional);
  const optInMarketing = Boolean(input.optInMarketing);

  if (!name) return { error: "Enter your name.", ok: false };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email.", ok: false };
  if (!phone) return { error: "Enter a phone number.", ok: false };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const userAgent = (h.get("user-agent") || "").slice(0, 400);

  if (!(await consumeRateLimit(`contact:${ip}`, 8, 3600))) {
    return { error: "Too many submissions from this connection. Please try again later.", ok: false };
  }

  // Consent record: store the verbatim language for whatever the user checked.
  const consentParts: string[] = [`v${SMS_CONSENT_VERSION}`];
  if (optInTransactional) consentParts.push(`[transactional] ${TRANSACTIONAL_CONSENT}`);
  if (optInMarketing) consentParts.push(`[marketing] ${MARKETING_CONSENT}`);
  const consentText = consentParts.join("\n");

  const admin = createAdminClient();
  const { error } = await admin.from("contact_submissions").insert({
    name,
    email,
    phone,
    message,
    opt_in_transactional: optInTransactional,
    opt_in_marketing: optInMarketing,
    consent_text: consentText,
    ip,
    user_agent: userAgent,
  });
  if (error) return { error: error.message, ok: false };

  // Mirror into the CRM (best-effort) so the team sees it in the pipeline.
  try {
    const nowIso = new Date().toISOString();
    const tags = ["src:contact"];
    if (optInTransactional) tags.push("sms:transactional");
    if (optInMarketing) tags.push("sms:marketing");
    const { data: existing } = await admin.from("crm_contacts").select("id, tags").eq("email", email).maybeSingle();
    const ex = existing as { id: string; tags: string[] | null } | null;
    let contactId = ex?.id;
    // SMS consent columns power the CRM's SMS automations gating. Only ever set
    // a flag true (opt-in) here — never flip an existing true back to false from
    // an unchecked box, so a prior opt-in isn't silently revoked.
    const consentUpdate: Record<string, boolean> = {};
    if (optInTransactional) consentUpdate.sms_transactional_consent = true;
    if (optInMarketing) consentUpdate.sms_marketing_consent = true;

    if (contactId) {
      const mergedTags = Array.from(new Set([...(ex?.tags ?? []), ...tags]));
      await admin
        .from("crm_contacts")
        .update({ name: name || undefined, phone: phone || undefined, last_activity_at: nowIso, updated_at: nowIso, tags: mergedTags, ...consentUpdate })
        .eq("id", contactId);
    } else {
      const { data: created } = await admin
        .from("crm_contacts")
        .insert({ email, name, phone, first_source: "contact", last_activity_at: nowIso, tags, ...consentUpdate })
        .select("id")
        .single();
      contactId = (created as { id: string } | null)?.id;
    }
    if (contactId) {
      await admin.from("crm_activities").insert({
        contact_id: contactId,
        kind: "lead",
        subject: "Contact form",
        body: message || "Contact form submission",
        meta: { source: "contact", opt_in_transactional: optInTransactional, opt_in_marketing: optInMarketing, consent_version: SMS_CONSENT_VERSION, ip },
      });
    }
  } catch (e) {
    console.error("[contact] crm mirror failed", e);
  }

  // Notify the team (best-effort).
  try {
    await sendEmail({
      to: [BILLING_OWNER_EMAIL],
      subject: `New contact form — ${email}`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:560px;">
        <p style="font-size:15px;"><strong>${esc(name)}</strong> · ${esc(email)} · ${esc(phone)}</p>
        ${message ? `<p style="font-size:15px;color:#525252;white-space:pre-wrap;">${esc(message)}</p>` : ""}
        <p style="font-size:13px;color:#737373;">SMS opt-in — appointments: <strong>${optInTransactional ? "yes" : "no"}</strong> · marketing: <strong>${optInMarketing ? "yes" : "no"}</strong></p>
      </div>`,
      replyTo: email,
    });
  } catch {
    /* best-effort */
  }

  return { error: null, ok: true };
}
