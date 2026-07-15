# Global Payments (Genius POS) — partner onboarding readiness

This is the intake checklist for wiring Global Payments as a **direct POS
integration** (restaurant sales → Business Health, customers → Guests, per
location) — the same shape as the Square connector, but on the Global Payments
GP API.

We already have a working GP API client (`src/lib/global-payments.ts`) used for
subscription billing. The POS connector reuses that client; the only open pieces
are (a) how a customer authorizes us to read *their* merchant data and (b) the
exact reporting fields. Both come from partner onboarding.

## What we need from Global Payments partner onboarding

Bring these back and the connector can be finished quickly:

1. **Partner/ISV account access** — confirmation the NDA/partner agreement is
   signed and our partner account is provisioned (sandbox first).
2. **The connection model for third-party merchants.** How does a restaurant
   authorize Wingman to read their data? One of:
   - **Merchant boarding under our partner** — we create/sub-provision the
     merchant and hold credentials for them, or
   - **Partner OAuth / delegated access** — the merchant approves us and we
     receive a scoped token, or
   - **Per-merchant app credentials** — the merchant supplies their own
     `app_id`/`app_key`.
   This decides the "Connect" UX (one-click vs. credential entry) and what we
   store.
3. **Sandbox partner credentials** to build/test against (partner `app_id`/
   `app_key`, or the partner OAuth client id/secret + redirect registration).
4. **Required scopes/permissions** for read-only reporting:
   - transactions/settlement reporting (the `TRN_GET_*` / reporting permissions),
   - customer/tokenized-payer read, if we want customers → Guests.
5. **Reporting endpoints + filters** on GP API for pulling a merchant's
   settled sales by date range and by **location/store** (the multi-location
   mapping key — a Genius store id or name we can match to a Wingman location).
6. **Rate limits / sync cadence** guidance (Square syncs daily; confirm GP is OK
   with a daily pull of the last N days per merchant).
7. **Webhooks (optional)** — whether GP can push transaction/settlement events so
   we can sync near-real-time instead of polling.

## What's already in place

- **GP API client** — access token (SHA512 secret), account resolution from the
  token scope, `/transactions` and `/payment-methods` calls. The POS sync will
  add a read path over `/transactions` (reporting) using the same auth.
- **Direct integrations UI slot** — a "Global Payments (Genius POS)" row is shown
  under Settings → API access → Direct integrations, marked "Onboarding in
  progress." It becomes a live Connect/Sync/Disconnect card once the model above
  is known (mirrors the Square card).
- **Per-location from day one** — like Square, each Genius store maps to a Wingman
  location by name; unmatched sales roll up account-wide.

## Build plan once onboarding lands

1. Add a secure `global_payments_pos_connections` table (deny-all RLS, service-
   role only — same pattern as `square_connections` / `billing_payment_methods`),
   storing whatever the connection model yields (token/refresh or merchant refs)
   plus the per-location store map.
2. Add `src/lib/global-payments-pos-sync.ts` — pull settled transactions for the
   last 7 days, map by store → Wingman location into Business Health, and
   (optionally) customers → Guests, deduped by email/phone. Model it on
   `src/lib/square-sync.ts`.
3. Wire the Direct integrations card: Connect (per the model), Sync now,
   Disconnect; a daily `/api/cron/global-payments-pos-sync` cron.
4. Help + sales playbook: promote the row from "onboarding in progress" to a
   live connector with per-location notes.
