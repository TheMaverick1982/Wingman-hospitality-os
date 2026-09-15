# Google OAuth verification — Business Profile (Google reviews)

Everything needed to move the Google reviews integration from **Testing** to a
verified, self-serve **Production** app. All steps are in the Google Cloud
console for project **812648547166** unless noted. No code changes are required
beyond the privacy-policy disclosure (already shipped on `/privacy`).

## Why verify

- **Testing mode** limits connections to pre-added test users (max 100) **and
  expires each connection's refresh token after 7 days** — so connections drop
  weekly. Not viable for real customers.
- **Publishing to Production** removes the 7-day expiry and lets any customer
  connect. Until verification completes they see an "unverified app" warning and
  there's a 100-user cap.
- **Verification approved** removes the warning and the cap → clean self-serve.

## The one scope we request

`https://www.googleapis.com/auth/business.manage` (plus `openid`, `email`,
`profile` for sign-in). We use it **read-only** — list the owner's Business
Profile accounts/locations and read each location's reviews. We never post,
edit, or delete.

## Console checklist (Google Auth Platform → project 812648547166)

- [ ] **Branding**: app name (Wingman), user-support email, developer-contact
      email, app logo (120×120 PNG), app homepage `https://www.joinwingman.app`,
      privacy policy `https://www.joinwingman.app/privacy`, and **Authorized
      domains** includes `joinwingman.app`.
- [ ] **Verify domain ownership** of `joinwingman.app` in Google Search Console
      with the same Google account (required before verification).
- [ ] **Data access**: the project's consent screen requests THREE sensitive
      scopes — `.../auth/business.manage` (restaurant Google reviews) plus
      `.../auth/calendar.readonly` and `.../auth/calendar.events` (Wingman's own
      booking scheduler). All three need a justification + the shared demo video.
- [ ] **Clients**: the Web application client has the redirect URIs
      `https://www.joinwingman.app/api/integrations/google-business/callback`
      (add the apex `https://joinwingman.app/...` too if the site ever serves there).
- [ ] **Audience → Publish app** → status **In production**.
- [ ] Submit for verification and complete the OAuth verification form (below).

## Scope justifications (paste one per scope into the verification form)

The consent screen requests three sensitive scopes. Each needs its own
justification; one demo video (below) covers all three.

**`https://www.googleapis.com/auth/business.manage`**

> Wingman is a retention platform for restaurants. A restaurant owner connects
> their own Google Business Profile so Wingman can display their Google reviews
> in-app and generate an AI summary (rating, trend, recurring themes, suggested
> actions). This is the only scope that grants read access to a location's reviews
> via the Business Profile APIs, and we use it strictly read-only — we list the
> accounts/locations the user manages and read their reviews. We never post,
> reply, edit, or delete anything on the Business Profile. Data is shown only to
> the authorized members of the connecting user's own Wingman account; we do not
> use it for advertising, sell it, or transfer it except to the service providers
> operating the feature. Use complies with the Google API Services User Data
> Policy, including Limited Use, as disclosed at https://www.joinwingman.app/privacy .

**`https://www.googleapis.com/auth/calendar.readonly`**

> Wingman includes a built-in meeting scheduler used to book calls/demos. When a
> visitor picks a time, Wingman reads the connected team member's free/busy
> availability with calendar.readonly so it only offers genuinely open slots and
> never double-books. We read availability only to render open time slots; we do
> not download or store unrelated calendar content. Complies with the Google API
> Services User Data Policy, including Limited Use.

**`https://www.googleapis.com/auth/calendar.events`**

> After a visitor selects a time, Wingman creates the meeting on the connected
> team member's Google Calendar with the meeting details and a video link
> (calendar.events), and updates or cancels that event if the booking is
> rescheduled or canceled. We only create and manage the events Wingman itself
> books on behalf of the account holder — we do not read, modify, or delete
> unrelated events. Complies with the Google API Services User Data Policy,
> including Limited Use.

## Demo video script (one recording, ~3 min, narrated)

Google wants to see the real OAuth consent flow for EACH scope and how the data
is used. Record on production (`joinwingman.app`). Upload the video **Unlisted on
YouTube** and paste the link in the verification form's "Video link" field.

**Part 1 — Business Profile (business.manage)**
1. Show `joinwingman.app`: "This is Wingman, a retention platform for restaurants."
2. Go to **Guests → Reviews → Google reviews tab → Connect Google**. Narrate:
   "The owner connects their own Google Business Profile to see their reviews."
3. Show the consent screen in full (URL bar `accounts.google.com` + the requested
   Business Profile permission visible). Approve it.
4. Show the redirect back to `https://www.joinwingman.app/api/integrations/google-business/callback`.
5. Link a location, show the pulled reviews and the AI "Wingman's read." Narrate:
   "Read-only — we display and summarize reviews, we never post or edit."

**Part 2 — Scheduler (calendar.readonly + calendar.events)**
6. Open the booking scheduler (Admin → Calendar / a `/book/<slug>` page). Narrate:
   "Wingman has a built-in scheduler for booking calls."
7. Show the slot picker only offering open times — "that's calendar.readonly
   reading free/busy so we never double-book."
8. Complete a booking, then show the event created on the Google Calendar with the
   details/video link — "that's calendar.events; we only manage events Wingman
   books, never unrelated events."

**Part 3 — Privacy**
9. Open `/privacy`, scroll to "Google user data (Business Profile)" and show the
   Limited Use sentence.

## Notes

- Keep the app in Testing until this client's setup is demoed, then publish.
- Publishing to Production fixes the 7-day token expiry immediately, even before
  verification finishes.
- The privacy-policy Google-data section is live at `/privacy` (shipped with this doc).
