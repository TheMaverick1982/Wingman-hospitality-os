import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Handles the links in Supabase auth emails: team invites, password-reset
// recovery, and signup confirmation.
//
// Two link formats are supported so it works no matter how the email templates
// are configured:
//   1. token_hash + type  — the format used by invite / recovery / signup
//      templates that use {{ .TokenHash }}. Verified with verifyOtp().
//   2. code               — the PKCE format ({{ .ConfirmationURL }} on some
//      flows). Exchanged with exchangeCodeForSession().
//
// Invited members and password resets have no password yet, so both are sent on
// to /set-password to choose one (which also signs them in).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Optional post-set-password landing spot (e.g. affiliates return to their
  // dashboard). Only accept safe, in-app relative paths to avoid open redirects.
  const rawNext = searchParams.get("next") || "";
  const safeNext = /^\/(?!\/)/.test(rawNext) ? rawNext : "";

  const needsPassword = type === "invite" || type === "recovery";
  const destination = needsPassword
    ? `/set-password${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`
    : "/";

  const supabase = await createClient();

  // 1) token_hash flow (invite / recovery / signup emails).
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${destination}`);
  }

  // 2) PKCE code flow.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destination}`);
  }

  // Couldn't establish a session from the link (expired, already used, or a
  // malformed link) — send them to sign in with a hint.
  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
