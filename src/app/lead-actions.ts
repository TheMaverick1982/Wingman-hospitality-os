"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isHoneypotFilled } from "@/lib/honeypot";
import { sendEmail } from "@/lib/email";
import { BILLING_OWNER_EMAIL } from "@/lib/billing";

export type LeadState = { error: string | null; ok: boolean };

const VALID_SOURCES = new Set(["calculator", "scorecard"]);

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

// Capture a marketing lead from a public tool. Stores it and notifies the team.
// Optionally emails the prospect a copy of their result (`resultHtml`).
export async function captureLead(input: {
  source: string;
  email: string;
  name?: string;
  payload?: Record<string, unknown>;
  summary?: string; // short human summary for the team email
  resultHtml?: string; // if set, also emailed to the prospect
  hp?: string; // honeypot; real users leave this empty
}): Promise<LeadState> {
  // Spam bot filled the hidden honeypot field. Pretend success; store nothing.
  if (isHoneypotFilled(input.hp)) return { error: null, ok: true };

  const email = String(input.email || "").trim().toLowerCase();
  const source = String(input.source || "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address.", ok: false };
  if (!VALID_SOURCES.has(source)) return { error: "Unknown source.", ok: false };

  if (!(await consumeRateLimit(`lead:${await clientIp()}`, 8, 3600))) {
    return { error: "Too many submissions from this connection. Please try again later.", ok: false };
  }

  const name = String(input.name || "").trim() || null;
  const admin = createAdminClient();
  const { error } = await admin.from("leads").insert({ email, name, source, payload: input.payload ?? {} });
  if (error) return { error: error.message, ok: false };

  // Notify the team (best-effort).
  try {
    await sendEmail({
      to: [BILLING_OWNER_EMAIL],
      subject: `New Wingman lead (${source}) — ${email}`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:520px;">
        <p style="font-size:15px;">New lead from the <strong>${esc(source)}</strong>.</p>
        <p style="font-size:15px;">Email: <strong>${esc(email)}</strong>${name ? ` · ${esc(name)}` : ""}</p>
        ${input.summary ? `<p style="font-size:14px;color:#525252;">${esc(input.summary)}</p>` : ""}
      </div>`,
      replyTo: email,
    });
  } catch {
    /* best-effort */
  }

  // Send the prospect their result (best-effort).
  if (input.resultHtml) {
    try {
      await sendEmail({ to: [email], subject: "Your Wingman results", html: input.resultHtml });
    } catch {
      /* best-effort */
    }
  }

  return { error: null, ok: true };
}
