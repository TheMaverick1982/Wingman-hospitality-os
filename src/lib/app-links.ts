// Native app store links.
//
// Both apps are live, so these are the published, canonical store URLs. They're
// public (not secrets), so we hardcode them as defaults — the /download page
// and every "Get the app" surface work on deploy with no env setup required.
// The NEXT_PUBLIC_* env vars still override, so a link can be changed in Vercel
// without a code change if a listing URL ever moves.
export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL || "https://apps.apple.com/app/wingman-hospitality/id6792361063";
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL || "https://play.google.com/store/apps/details?id=com.joinwingman.app";

export const APPS_LIVE = Boolean(APP_STORE_URL || PLAY_STORE_URL);
