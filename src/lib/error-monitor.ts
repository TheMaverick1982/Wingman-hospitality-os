import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// The built-in error monitor. reportError() records a runtime error, grouped by
// a stable fingerprint (so the same bug is one row with a count), and emails an
// alert the first time a new fingerprint appears — with a hand-off-ready issue
// you can paste straight to Claude. Everything here is best-effort and never
// throws into the caller: monitoring must not itself break a request.

const ALERT_TO = process.env.MONITOR_ALERT_EMAIL ?? "brian@brianhardy.com";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

export type ErrorSource = "client" | "server" | "action";

// Next.js uses thrown "errors" for redirect()/notFound() control flow — never
// treat those as bugs.
function isControlFlow(message: string, stack: string | undefined): boolean {
  const s = `${message}\n${stack ?? ""}`;
  return /NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE/.test(s);
}

// Group the same bug together: normalize volatile bits (ids, numbers, hex) out
// of the message + top stack frame, then hash with the route.
function fingerprintOf(message: string, stack: string | undefined, route: string | undefined): string {
  const norm = (s: string) =>
    s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "#").replace(/0x[0-9a-f]+/gi, "#").replace(/\d+/g, "#");
  const firstFrame = (stack ?? "").split("\n").map((l) => l.trim()).find((l) => l.startsWith("at ")) ?? "";
  return createHash("sha1").update(`${norm(message)}|${norm(firstFrame)}|${route ?? ""}`).digest("hex").slice(0, 16);
}

export async function reportError(input: {
  error: unknown;
  source: ErrorSource;
  route?: string | null;
  orgId?: string | null;
  userEmail?: string | null;
}): Promise<void> {
  try {
    const err = input.error;
    const rawMessage = err instanceof Error ? err.message : String(err ?? "Unknown error");
    const message = (rawMessage || "Unknown error").slice(0, 500);
    const stack = err instanceof Error && err.stack ? err.stack.slice(0, 4000) : undefined;
    const route = input.route ? String(input.route).slice(0, 300) : undefined;
    if (isControlFlow(message, stack)) return;

    const fingerprint = fingerprintOf(message, stack, route);
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: existing } = await admin
      .from("error_events")
      .select("id, count")
      .eq("fingerprint", fingerprint)
      .maybeSingle();

    if (existing) {
      await admin
        .from("error_events")
        .update({
          count: ((existing as { count: number }).count ?? 1) + 1,
          last_seen: now,
          message,
          stack,
          route,
          org_id: input.orgId ?? null,
          user_email: input.userEmail ?? null,
          resolved: false, // a recurrence reopens it
        })
        .eq("id", (existing as { id: string }).id);
      return;
    }

    const { data: created } = await admin
      .from("error_events")
      .insert({
        fingerprint,
        message,
        stack,
        route,
        source: input.source,
        org_id: input.orgId ?? null,
        user_email: input.userEmail ?? null,
        count: 1,
        first_seen: now,
        last_seen: now,
      })
      .select("id")
      .single();

    // First time we've seen this bug → alert once.
    await alertNewError({ message, stack, route, source: input.source, userEmail: input.userEmail ?? null });
    if ((created as { id: string } | null)?.id) {
      await admin.from("error_events").update({ alerted_at: now }).eq("id", (created as { id: string }).id);
    }
  } catch (e) {
    console.error("[monitor] reportError failed", e);
  }
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

async function alertNewError(e: { message: string; stack?: string; route?: string; source: ErrorSource; userEmail: string | null }): Promise<void> {
  if (!process.env.RESEND_API_KEY) return; // no mailer configured — dashboard still has it
  // The hand-off block: paste this straight to Claude to get a fix.
  const issue = [
    `Bug in Wingman (auto-detected by the error monitor).`,
    ``,
    `Route: ${e.route ?? "unknown"}`,
    `Source: ${e.source}`,
    `Error: ${e.message}`,
    ``,
    `Stack:`,
    (e.stack ?? "(no stack)").split("\n").slice(0, 12).join("\n"),
    ``,
    `Please find the root cause and fix it.`,
  ].join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;max-width:640px;">
    <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#0a6cff;margin:0 0 6px;">New bug detected</p>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;">${esc(e.message)}</h1>
    <p style="font-size:13.5px;color:#525252;margin:0 0 16px;">
      A customer just hit this on <strong>${esc(e.route ?? "an unknown route")}</strong>${e.userEmail ? ` (${esc(e.userEmail)})` : ""}. It's now on your <a href="${SITE}/admin/health" style="color:#0a6cff;">Health dashboard</a>.
    </p>
    <p style="font-size:13px;font-weight:700;color:#737373;margin:0 0 6px;">Hand this to Claude to fix it:</p>
    <pre style="background:#0f0f0f;color:#e5e5e5;border-radius:10px;padding:14px;font-size:12px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;">${esc(issue)}</pre>
  </div>`;

  try {
    await sendEmail({ to: [ALERT_TO], subject: `🐛 New bug: ${e.message.slice(0, 80)}`, html });
  } catch (err) {
    console.error("[monitor] alert email failed", err);
  }
}
