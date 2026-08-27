# Wingman Mobile App (iOS + Android via Capacitor)

Wingman ships to the App Store and Google Play as a **native shell around the
live web app**. The native app opens a full-screen native container that loads
`https://www.joinwingman.app` (set in `capacitor.config.json` → `server.url`).
This means:

- **You reuse the entire existing app** — no second codebase.
- **Updates are instant** — pushing to production updates the app's content with
  no App Store re-review (only native changes, like a new plugin, need a
  resubmit).
- Native capabilities (push notifications, splash, status bar, camera) are added
  as Capacitor plugins — that's Phase 3.

Everything below runs **on a Mac** (iOS builds require Xcode). It's a one-time
setup; after that it's just `git pull` + rebuild.

---

## Prerequisites (install once)

| Tool | How |
|---|---|
| **Xcode** | Mac App Store (free, large download). Open it once to accept the license. |
| **CocoaPods** | `sudo gem install cocoapods` (or `brew install cocoapods`) |
| **Android Studio** | https://developer.android.com/studio (free) |
| **Node 20+** | Already have it if you've been running the site. |

You'll also need the developer accounts before you can *submit* (not needed just
to build/run in a simulator):
- **Apple Developer Program** — https://developer.apple.com/programs ($99/yr)
- **Google Play Console** — https://play.google.com/console ($25 once)

---

## One-time setup

From the project root:

```bash
# 1. Install dependencies (this pulls in Capacitor).
npm install

# 2. Create the native iOS and Android projects.
#    This generates ios/ and android/ folders (commit them).
npx cap add ios
npx cap add android

# 3. Generate all native app-icon and splash-screen sizes from the source
#    images in assets/ (icon.png + splash.png, already in the repo).
npx @capacitor/assets generate --iconBackgroundColor '#0a6cff' --iconBackgroundColorDark '#0a6cff' --splashBackgroundColor '#0a6cff' --splashBackgroundColorDark '#0a6cff'

# 4. Sync config + assets into the native projects.
npx cap sync
```

---

## Run it in a simulator

```bash
npx cap open ios       # opens Xcode      -> press ▶ to run in the iPhone simulator
npx cap open android   # opens Android Studio -> press ▶ to run in the emulator
```

The app should launch, briefly show the blue Wingman loading screen
(`native/www/index.html`), then load the live site full-screen.

---

## Key facts

- **Bundle ID / package name:** `app.joinwingman` (in `capacitor.config.json`).
  This is permanent once you submit to the stores — register the **exact same**
  identifier in Apple Developer and Google Play. Change it *now* if you want
  something different, before the first submission.
- **App name:** `Wingman`.
- **What loads:** `server.url` = `https://www.joinwingman.app`. To test against a
  local dev server instead, temporarily change `server.url` to your machine's LAN
  address (e.g. `http://192.168.x.x:3000`) and set `cleartext: true`, then
  `npx cap sync`. Revert before building for release.

---

## After any change

- **Web/content change** (anything in the Next.js app): just deploy to
  production as usual — the app picks it up automatically. No rebuild needed.
- **Native change** (Capacitor config, a new plugin, new icon): run
  `npx cap sync`, then rebuild in Xcode / Android Studio.

---

## What's next (Phase 3)

- **Push notifications** — `@capacitor/push-notifications` + a send path
  (shift reminders, bounce-back alerts, "audit due"). This is also the native
  capability that gets the app past Apple's "not just a website" review bar.
- **Native polish** — status-bar styling, splash timing, and (optionally) the
  native camera for menu photo uploads.
- **Store submission** — icons (done), screenshots, privacy policy, listing copy,
  then submit through Xcode/App Store Connect and Google Play Console.

---

## Google Play "app quality" requirements (do before the first Android release)

Google Play is rolling out quality thresholds (memory, bitmaps, code
optimization, unexpected terminations) plus a device-migration standard. **Most
are measured from real-world usage**, so with no users there's nothing to fix yet
— you can't fail a usage-based threshold with no traffic. Revisit **Play Console →
Quality → Android vitals** once you have real users (targets: user-perceived
crash rate < 1.09%, ANR rate < 0.47%).

The **only** thing Google can assess pre-launch — from the app bundle itself, not
usage — is **code optimization (R8)**. Capacitor ships with it **off**, so turn it
on for the release build. Do this once, after `npx cap add android` generates the
`android/` project.

### 1. Enable R8 code shrinking — `android/app/build.gradle`

In the `android { buildTypes { ... } }` block, set the **release** type to:

```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### 2. Keep rules — `android/app/proguard-rules.pro`

Capacitor loads plugins by name via reflection and bridges JS through
`@JavascriptInterface`, so R8 will break the app without these keeps. Append:

```proguard
# --- Capacitor / Cordova (required so R8 doesn't strip the plugin bridge) ---
-keep public class * extends com.getcapacitor.Plugin
-keep @com.getcapacitor.annotation.CapacitorPlugin public class *
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public <methods>;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
# Our installed plugins (App, SplashScreen, StatusBar) live under these:
-keep class com.capacitorjs.plugins.** { *; }
-dontwarn com.getcapacitor.**
```

**Then build a release `.aab` and actually run it once** — a mis-shrunk plugin
only shows at runtime, so verify login, splash, and status bar work before
uploading. (Debug builds don't shrink, so this must be tested on a release build.)

### 3. Device migration (trivial for a login app)

Google's "seamless device migration" standard is about not breaking when a user
restores your app on a new phone. Wingman is login-based and server-backed, so
there's no local data to migrate — the user just logs back in. Just confirm a
**fresh install → login** works and doesn't crash, and leave Android's default
`android:allowBackup` behavior in `AndroidManifest.xml` as generated (fine for a
no-local-state app).

Bottom line: enable R8 (steps 1–2) before the first Android upload; everything
else waits for real users.
