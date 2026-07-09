// Native app store links.
//
// Leave these empty until the apps are live. While empty, the /download page
// shows "add to home screen" instructions (the PWA is installable today) plus a
// "coming soon" note. Once the apps are published, set these in Vercel's
// environment variables and the page automatically switches to store badges --
// no code change needed.
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "";

export const APPS_LIVE = Boolean(APP_STORE_URL || PLAY_STORE_URL);
