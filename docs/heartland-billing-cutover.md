# Heartland / Portico billing — cutover guide

Wingman's live card processor is **Heartland/Portico (SecureSubmit)**, certified
Card-Not-Present. This is the checklist to move billing from the legacy GP-API
path onto the certified Portico path. It's a **one-env-var flip** with an instant
rollback — the code for both providers ships together.

## What already ships (this PR)
- **Server billing on Portico** (`src/lib/billing/heartland.ts`) — store a card
  (Account Verify → multi-use token), charge the token, refund, void. The calls
  mirror exactly the flow that **passed Heartland certification**.
- **Provider switch** in `src/lib/global-payments.ts`: `BILLING_PROVIDER=heartland`
  routes all card storage + charges through Portico. Every caller (Settings
  actions, `billing-charge` / `franchise-billing` crons) is unchanged — only the
  implementation swaps underneath. Default (`gpapi`) keeps today's behavior, so
  merging this changes nothing until the flag is set.
- The `globalpayments-api` SDK, kept external to the server bundle
  (`serverExternalPackages`).
- `/api/billing/gp-client-token` is provider-aware: on Heartland it returns the
  publishable `pkapi_…` public key for the browser tokenizer.

## The one piece still to build: the client card form
The current hosted-fields component (`gp-hosted-fields.tsx`) tokenizes with the
**GP-API** library. Heartland/SecureSubmit tokenizes client-side with the
**public key** (`pkapi_…`) via Global Payments' SecureSubmit JS. This is the only
remaining code, and it should be built **against the sandbox with a real browser
test** (card entry → single-use token → server stores multi-use token). Until
then, the sandbox raw-test-card path (`gpStoreTestCard`) exercises the full
store→charge loop end-to-end without the browser library.

## Env vars (set in Vercel — never commit secrets)
| Var | Sandbox (cert) | Production |
|---|---|---|
| `BILLING_PROVIDER` | `heartland` | `heartland` |
| `HEARTLAND_ENVIRONMENT` | `sandbox` | `production` |
| `HEARTLAND_SECRET_API_KEY` | `skapi_cert_…` | `skapi_prod_…` |
| `HEARTLAND_PUBLIC_KEY` | `pkapi_cert_…` | `pkapi_prod_…` |
| `HEARTLAND_DEVELOPER_ID` | `002914` | `002914` |
| `HEARTLAND_VERSION_NUMBER` | `6391` | `6391` |

Secret key is server-only; the public key is publishable (browser). Production
keys go straight into Vercel by a human — never into chat or the repo.

## Cutover steps
1. **Certification approved** by Heartland (the review form is submitted).
2. **Build + test the client card form** in a preview with the **sandbox** vars
   above — confirm a card can be added and a $1 charge captures.
3. **Add production vars** in Vercel (Production scope) and **redeploy**.
4. **Migrate existing stored cards** if any live customers exist on the GP-API
   path: their GP `PMT_…` tokens don't work on Portico, so those customers
   re-enter a card once. (If billing hasn't gone live yet, nothing to migrate.)
5. Flip is now active. Watch the first `billing-charge` cron run.

## Rollback
Set `BILLING_PROVIDER=gpapi` (or unset it) and redeploy — instantly reverts to
the previous path. No code change required.
