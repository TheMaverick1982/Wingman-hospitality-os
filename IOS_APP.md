# Wingman iOS App — Build & Upload Guide (Capacitor)

This wraps the live Wingman web app (`https://www.joinwingman.app`) in a native
iOS shell using Capacitor, so it can go in the App Store. The native project isn't
committed — you generate it on your Mac (it's large and machine-specific), then
build and upload from Xcode.

Config lives in `capacitor.config.json`:
- **App name:** Wingman
- **Bundle ID:** `com.joinwingman.app` ← register this exact ID in Apple Developer
- **Loads:** `https://www.joinwingman.app` (the live app)

---

## 0. One-time prerequisites (on your Mac)

1. **Xcode** — install from the Mac App Store, open it once to accept the license and let it install components.
2. **CocoaPods** — `sudo gem install cocoapods` (or `brew install cocoapods`).
3. **Node** — same version you use elsewhere; then in the repo: `npm install`.
4. **Apple Developer** — you're paid & approved ✅. Have your Team ID handy (Apple Developer → Membership).

---

## 1. Generate the iOS project

From the repo root on your Mac:

```bash
npm install
npx cap add ios        # creates the ios/ native project (first time only)
npx cap sync ios       # copies config + installs native deps (pods)
```

If `cap add ios` says iOS already exists, skip straight to `npx cap sync ios`.

---

## 2. App icon & splash

You need a **1024×1024 PNG** app icon (no transparency, no rounded corners — Apple adds those).

1. Put your source art at `assets/icon.png` (1024×1024) and optionally `assets/splash.png` (2732×2732, logo centered on `#0a6cff`).
2. Generate all sizes:
   ```bash
   npx capacitor-assets generate --ios
   ```
   (`@capacitor/assets` is already a dev dependency.)
3. `npx cap sync ios` again.

> Don't have a 1024 icon yet? Export one from `public/icons/icon-512.png` scaled up, or send me the source and I'll prep the asset set.

---

## 3. Open in Xcode & configure signing

```bash
npx cap open ios
```

In Xcode, select the **App** target → **Signing & Capabilities**:
- **Team:** your Apple Developer team.
- **Bundle Identifier:** `com.joinwingman.app` (must match the App ID you register — see step 4). Xcode's "Automatically manage signing" will create the provisioning profile.
- **Display Name:** Wingman
- General tab → **Version** `1.0.0`, **Build** `1`.
- **Deployment target:** iOS 16.0+ (matches our PWA/push baseline).

---

## 4. Register the App ID + create the App Store record

1. **App Store Connect** (appstoreconnect.apple.com) → **Apps → +** → New App.
   - Platform: iOS · Name: **Wingman** · Primary language · Bundle ID: **com.joinwingman.app** · SKU: `wingman-ios`.
   - (If the bundle ID isn't in the dropdown, register it first at Apple Developer → Certificates, IDs & Profiles → Identifiers → +.)

---

## 5. Archive & upload

In Xcode:
1. Select **Any iOS Device (arm64)** as the run destination (not a simulator).
2. **Product → Archive**.
3. When the Organizer opens: **Distribute App → App Store Connect → Upload** → follow the prompts.
4. Wait for the build to finish processing in App Store Connect (a few minutes to an hour).

---

## 6. TestFlight (test before submitting)

App Store Connect → your app → **TestFlight** → add yourself as an internal tester → install via the TestFlight app on your iPhone and confirm login, dashboard, booking, etc. all work.

---

## 7. App Store listing (required before submit)

Under the app's **App Store** tab:
- **Screenshots** — required for 6.7" iPhone (1290×2796) at minimum. Capture from the app or Simulator.
- **Description, keywords, promotional text.**
- **Support URL:** `https://www.joinwingman.app/contact`
- **Privacy Policy URL:** `https://www.joinwingman.app/privacy`
- **App Privacy** questionnaire — declare what you collect (name, email, phone, usage). Be accurate; it must match the privacy policy.
- **Category:** Business (secondary: Productivity).
- **Sign-in required?** Provide a **demo/reviewer account** (a real login) in *App Review Information → Notes* so the reviewer can get past the login screen.

---

## 8. Submit & the two things reviewers will poke at

**Guideline 4.2 (minimum functionality / "just a website").** This is the main risk for a web-wrapped app. Preempt it in the **App Review notes**:
- State plainly it's a **staff operations tool** (training, checklists, guest tracking, dashboards) used on-shift — not a marketing site.
- Note it supports **offline** and **installs/behaves like a native app**.
- Give the reviewer **login credentials** so they see the real app, not the marketing pages.

**Guideline 5.1.1 (account management).** We're covered:
- **Account deletion** is reachable in-app at `/delete-account` (Apple requires this for apps with accounts).
- **Privacy policy** at `/privacy`.
- **Sign in with Apple** is **not** required — user login is email/password (the Google/Microsoft connections are for calendar/email features, not third-party *login*).

Then hit **Add for Review → Submit**.

---

## Updating the app later

The app loads the live site, so **most changes ship instantly with your normal web deploy** — no new App Store build needed. You only re-archive/upload when you change native bits (icon, splash, Capacitor plugins, iOS version, or add native push).

## Phase 2 (optional, later): native push (APNs)

The web-push we built works in the browser/PWA. A native app uses **APNs** instead. When you want native push: add `@capacitor/push-notifications`, an APNs auth key in Apple Developer, device-token registration, and a server-side APNs sender. Ping me and I'll wire it — not required for the first submission.
