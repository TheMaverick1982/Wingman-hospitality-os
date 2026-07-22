"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoEmail } from "@/lib/demo/constants";
import { ensureDemoUser, reseedDemoOrg } from "@/lib/demo/reseed";
import { consumeRateLimit, LOGIN_EMAIL_LIMIT, LOGIN_IP_LIMIT } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

// `requireHuman` tells the client to render the Turnstile widget and gate the
// submit button until it produces a token. It's set once a browser has failed
// enough times that we want proof-of-human before letting it keep guessing.
export type LoginState = { error: string | null; requireHuman?: boolean };

// Step-up policy: don't challenge every login — only after this many failed
// attempts from the same browser. A real person who typos their password once
// or twice never sees a challenge; a script hammering the form gets gated.
const REQUIRE_HUMAN_AFTER_FAILURES = 2;
// Per-browser failure counter. HttpOnly so page scripts can't rewrite it; the
// per-IP / per-email DB limiters remain the hard cap that also covers a bot that
// simply drops the cookie. Short-lived so a challenged user clears it by waiting.
const FAILURE_COOKIE = "wm_lf";
const FAILURE_COOKIE_MAX_AGE = 900; // 15 minutes

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const cookieStore = await cookies();
  const failures = Number.parseInt(cookieStore.get(FAILURE_COOKIE)?.value || "0", 10) || 0;
  const requireHuman = failures >= REQUIRE_HUMAN_AFTER_FAILURES;
  const setFailures = (n: number) =>
    cookieStore.set(FAILURE_COOKIE, String(n), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: n > 0 ? FAILURE_COOKIE_MAX_AGE : 0,
    });

  // Brute-force throttle (fail-open). Cap attempts per IP, and per email — but
  // exempt the shared demo account, which many people sign into at once. The
  // limiter is abuse protection; auth + RLS remain the real security boundary.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipOk = await consumeRateLimit(`login-ip:${ip}`, LOGIN_IP_LIMIT.max, LOGIN_IP_LIMIT.windowSeconds);
  const emailOk = isDemoEmail(email)
    ? true
    : await consumeRateLimit(`login-email:${email.toLowerCase()}`, LOGIN_EMAIL_LIMIT.max, LOGIN_EMAIL_LIMIT.windowSeconds);
  if (!ipOk || !emailOk) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", requireHuman };
  }

  // Step-up bot check: only enforced once this browser has failed enough times.
  // Fails open when TURNSTILE_SECRET_KEY isn't configured.
  if (requireHuman && !(await verifyTurnstile(formData.get("cf-turnstile-response") as string | null, ip))) {
    return { error: "Couldn't verify you're human — please try again.", requireHuman: true };
  }

  const supabase = await createClient();

  // Demo account: guarantee it exists with the known password before we try to
  // sign in, so the very first login (and any password rotation) self-heals.
  if (isDemoEmail(email)) {
    try {
      await ensureDemoUser();
    } catch (e) {
      console.error("[demo] ensureDemoUser failed", e);
    }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Count the failure so repeated wrong guesses step up to a human check.
    // The shared demo account is exempt (it self-heals and many people use it),
    // so an occasional demo miss never gates the next visitor.
    const next = isDemoEmail(email) ? failures : failures + 1;
    if (!isDemoEmail(email)) setFailures(next);
    return { error: error.message, requireHuman: next >= REQUIRE_HUMAN_AFTER_FAILURES };
  }

  // Clean login — clear the failure counter so the next sign-in starts fresh.
  setFailures(0);

  // On every successful demo sign-in, wipe + repopulate the demo org so each
  // viewer starts from the same clean, fully-populated showcase.
  if (isDemoEmail(email)) {
    try {
      await reseedDemoOrg();
    } catch (e) {
      // Don't block login if the reseed hiccups — they still land in a working
      // (if stale) demo. The next login will try again.
      console.error("[demo] reseedDemoOrg failed", e);
    }
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
