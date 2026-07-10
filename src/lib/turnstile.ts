import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Server-side verification of a Cloudflare Turnstile token.
//
// Fails OPEN when the secret isn't configured (so shipping the widget before
// TURNSTILE_SECRET_KEY is set in the environment can't lock real users out) and
// on a network error reaching Cloudflare (so an outage can't take down signup).
// Fails CLOSED only when Cloudflare explicitly rejects the token, or when the
// secret IS configured but no token was supplied (bot or a broken widget).
export async function verifyTurnstile(token: string | null | undefined, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured yet
  if (!token) return false; // configured, but nothing to verify

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);
    const res = await fetch(VERIFY_URL, { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return true; // Cloudflare unreachable -> don't block real users
  }
}
