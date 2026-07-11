import "server-only";

/**
 * The shared demo account. Signing in as this user triggers a full reseed of
 * the demo org (see reseed.ts), so every prospect starts from the same clean,
 * fully-populated showcase.
 */
export const DEMO_EMAIL = "wingmandemo@gmail.com";

/**
 * The demo password. Overridable via env for deployments that want to rotate
 * it; the fallback keeps local/dev logins working out of the box. The reseed
 * engine (re)sets the account to this password on every bootstrap, so this is
 * always the credential that works at /login.
 */
export const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "WingmanDemo2026!";

/** Case-insensitive check for the demo login. */
export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL;
}
