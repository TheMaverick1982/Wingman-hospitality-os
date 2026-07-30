import "server-only";
import { headers } from "next/headers";

// Detecting the native iOS app (a Capacitor WKWebView that loads the live site).
// The token is baked into the iOS build via capacitor.config.json
// (ios.appendUserAgentString), so it rides along on every request the app makes
// and the server can render the App Store-compliant, login-only experience with
// no flash — nothing forbidden ever reaches the DOM.
//
// Why this exists: Apple App Review rejected the iOS build under
//   - Guideline 3.1.1 (no in-app account/organization registration or external
//     purchase surfaces), and
//   - Guideline 4.8 (a third-party login — "Continue with Google" — with no
//     privacy-equivalent option).
// Rather than fork the app, we gate those surfaces to the iOS app only; the web
// experience is untouched. iOS becomes a login-only client for existing users
// (owners still sign up and pay on the website).
//
// NOTE: this token only takes effect in a REBUILT iOS binary (cap sync + rebuild).
// Resubmitting the old binary without rebuilding will not carry the token.
const IOS_NATIVE_UA_TOKEN = "WingmanNativeIOS";

/** True when the current request comes from the native iOS app. */
export async function isNativeIOS(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  return ua.includes(IOS_NATIVE_UA_TOKEN);
}
