"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { provisionDemoSandbox } from "@/lib/demo/reseed";
import { consumeRateLimit } from "@/lib/rate-limit";
import { formTrippedHoneypot, HONEYPOT_FIELD } from "@/lib/honeypot";
import { verifyTurnstile } from "@/lib/turnstile";
import { captureLead } from "@/app/lead-actions";

export type DemoStartState = { error: string | null };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function clientIp(headerList: Headers): string {
  return (headerList.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

// Spins up a private, isolated demo sandbox and signs the visitor in. Two jobs:
//   1. Capture the visitor as a lead (source: "demo") so they can be pulled into
//      a nurture/sign-up automation.
//   2. Gate against bots (which would otherwise farm AI credits by mass-creating
//      orgs) with cheap layers: honeypot, Cloudflare Turnstile, and a per-IP
//      rate limit. The seeded org also carries a short TTL and is reaped by the
//      demo-cleanup cron.
export async function startDemoSandbox(_prev: DemoStartState, formData: FormData): Promise<DemoStartState> {
  // Naive bots fill every field; drop them without creating anything.
  if (formTrippedHoneypot(formData)) {
    return { error: "Something went wrong. Please try again." };
  }

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid work email to start your demo." };
  }

  const headerList = await headers();
  const ip = clientIp(headerList);

  // The demo is public and hands out a full AI-enabled workspace, so unlike the
  // fail-open signup form we HARD-REQUIRE Turnstile here: if the secret isn't
  // configured, refuse to open the demo rather than leave the funnel wide open
  // to credit-farming bots. (verifyTurnstile still fails open on a Cloudflare
  // outage so a CF blip can't take the funnel down; honeypot + IP limit remain.)
  if (!process.env.TURNSTILE_SECRET_KEY) {
    console.error("[demo] TURNSTILE_SECRET_KEY is not set — refusing to open the public demo");
    return { error: "The demo is temporarily unavailable. Please try again shortly." };
  }
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response") as string | null, ip))) {
    return { error: "Couldn't verify you're human. Please refresh the page and try again." };
  }

  // A real person needs only one or two demos; this stops a solver-farm on a
  // single IP from spinning up orgs (and AI budgets) in bulk.
  if (!(await consumeRateLimit(`demo-start:${ip}`, 5, 3600))) {
    return { error: "You've started several demos recently — please try again in a little while." };
  }

  // Store the lead + notify the team (best-effort; never block the demo on it).
  try {
    await captureLead({
      source: "demo",
      email,
      name: name || undefined,
      payload: { via: "try-live-demo" },
      hp: (formData.get(HONEYPOT_FIELD) as string | null) ?? undefined,
    });
  } catch (e) {
    console.error("[demo] captureLead failed", e);
  }

  let creds: { email: string; password: string };
  try {
    creds = await provisionDemoSandbox({ leadEmail: email, leadName: name || undefined });
  } catch (e) {
    console.error("[demo] provisionDemoSandbox failed", e);
    return { error: "We couldn't spin up your demo just now. Please try again in a moment." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
  if (error) {
    console.error("[demo] sandbox sign-in failed", error);
    return { error: "We couldn't start your demo session. Please try again." };
  }

  redirect("/");
}
