import "server-only";
import crypto from "node:crypto";

// All Wingman API keys look like: wm_live_<32+ url-safe random chars>
const KEY_PREFIX = "wm_live_";

export function generateApiKey(): { plaintext: string; keyHash: string; keyPrefix: string } {
  const secret = crypto.randomBytes(24).toString("base64url"); // 32 url-safe chars
  const plaintext = `${KEY_PREFIX}${secret}`;
  return {
    plaintext,
    keyHash: hashApiKey(plaintext),
    // Non-secret display fragment: wm_live_ + first 6 chars of the secret.
    keyPrefix: plaintext.slice(0, KEY_PREFIX.length + 6),
  };
}

export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(KEY_PREFIX) && value.length >= KEY_PREFIX.length + 20;
}
