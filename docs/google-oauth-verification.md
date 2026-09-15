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
- [ ] **Data access**: `.../auth/business.manage` is listed and saved.
- [ ] **Clients**: the Web application client has the redirect URIs
      `https://www.joinwingman.app/api/integrations/google-business/callback`
      (add the apex `https://joinwingman.app/...` too if the site ever serves there).
- [ ] **Audience → Publish app** → status **In production**.
- [ ] Submit for verification and complete the OAuth verification form (below).

## Scope justification (paste into the verification form)

> Wingman is a retention and operations platform for restaurants. Restaurant
> owners connect their own Google Business Profile so Wingman can display their
> Google reviews inside the app and generate an AI summary for them — overall
> rating and trend, recurring themes in guest feedback, and concrete suggested
> actions to improve their rating.
>
> We request `https://www.googleapis.com/auth/business.manage` because it is the
> only scope that grants read access to a location's reviews via the Business
> Profile APIs (My Business Account Management, Business Information, and the
> Google My Business review endpoint). We use it strictly read-only: we list the
> accounts and locations the signed-in user manages and read their reviews. We do
> not post, reply to, edit, or delete anything on the user's Business Profile, and
> we do not modify any Business Profile data.
>
> Data is shown only to the authorized members of the connecting user's own
> Wingman account. We do not use Google user data for advertising, we do not sell
> it, and we do not transfer it except to the service providers that operate the
> feature (cloud hosting and our AI summarization provider) or where required by
> law. Our use of Google user data complies with the Google API Services User
> Data Policy, including the Limited Use requirements, as disclosed at
> https://www.joinwingman.app/privacy .

## Demo video script (screen recording, ~2–3 min, narrated)

Google wants to see the real OAuth consent flow and how the data is used. Record
on production (`joinwingman.app`) with a Business-Profile test account.

1. **Show the app + who it's for.** "This is Wingman, a retention platform for
   restaurants. I'm signed in as a restaurant owner."
2. **Start the connect.** Go to **Guests → Reviews → Connect Google**. Narrate:
   "The owner connects their own Google Business Profile to see their reviews in
   Wingman."
3. **Show the consent screen in full.** Let the URL bar (accounts.google.com) and
   the requested permission — "See and manage your Google Business Profile" — be
   clearly visible. Approve it.
4. **Show the redirect back** to `https://www.joinwingman.app/api/integrations/google-business/callback`
   landing on the Reviews page.
5. **Link a location** to its Google listing, then show the pulled reviews and the
   AI "Wingman's read" (strengths, where to improve, actions). Narrate: "We only
   read reviews to display them and summarize them for the owner — read-only, no
   posting."
6. **Show disconnect.** Point out "Disconnect Google" and mention access can also
   be revoked from the user's Google Account. Narrate the Limited Use commitment.
7. **Show the privacy policy** at `/privacy` — scroll to the "Google user data
   (Business Profile)" section with the Limited Use sentence.

## Notes

- Keep the app in Testing until this client's setup is demoed, then publish.
- Publishing to Production fixes the 7-day token expiry immediately, even before
  verification finishes.
- The privacy-policy Google-data section is live at `/privacy` (shipped with this doc).
