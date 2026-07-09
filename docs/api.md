# Wingman API (v1)

A small REST API so a customer can sync data between their POS / tools and
Wingman — for example, auto-populating the Revenue Growth Planner each week.

## Authentication

Every request needs an API key in the `Authorization` header:

```
Authorization: Bearer wm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

A **Super Admin** creates keys in **Settings → API access**. The full key is
shown **once** at creation — copy it then. Keys are:

- **Hashed at rest** — Wingman stores only a SHA-256 hash, never the key itself.
- **Scoped to one organization** — the org is derived from the key, so a key can
  only ever read/write that organization's data.
- **Revocable** — revoking a key in Settings makes it stop working immediately.

Base URL: `https://www.joinwingman.app`

All requests must be HTTPS. `401` means the key is missing, malformed, or revoked.

---

## Endpoints

### `POST /api/v1/growth` — record Revenue Growth Planner metrics

Upserts one period's numbers (one row per period; posting the same
`period_date` again updates it). Omit `location_id` for an org-wide entry.

Body:

| Field | Type | Required | Notes |
|---|---|---|---|
| `period_date` | string `YYYY-MM-DD` | ✅ | The week/period the numbers are for |
| `customers` | number | ✅ | Number of customers |
| `avg_sale` | number | ✅ | Average spend per customer |
| `repurchase_frequency` | number | ✅ | Repeat visits per period |
| `location_id` | string (uuid) | — | A location in your org; omit for all-locations |

```bash
curl -X POST https://www.joinwingman.app/api/v1/growth \
  -H "Authorization: Bearer $WINGMAN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"period_date":"2026-07-06","customers":820,"avg_sale":38.50,"repurchase_frequency":1.4}'
```

### `GET /api/v1/growth` — list recent metric entries

```bash
curl https://www.joinwingman.app/api/v1/growth -H "Authorization: Bearer $WINGMAN_KEY"
```

### `POST /api/v1/guests` — create a guest (optionally with a first visit)

Body: `name` (required), `phone`, `email`, and an optional `visit`
(`visit_number` 1–4, `visit_date` `YYYY-MM-DD`, `location_id`, `incentive`, `notes`).

```bash
curl -X POST https://www.joinwingman.app/api/v1/guests \
  -H "Authorization: Bearer $WINGMAN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Diner","email":"jane@example.com","visit":{"visit_number":1,"visit_date":"2026-07-06"}}'
```

### `GET /api/v1/guests` — list recent guests with their visits

```bash
curl https://www.joinwingman.app/api/v1/guests -H "Authorization: Bearer $WINGMAN_KEY"
```

---

## Using it with Zapier

1. In Wingman: **Settings → API access → Create key** (copy it).
2. In Zapier: add a **"Webhooks by Zapier"** action, method **POST**, URL the
   endpoint above, add the header `Authorization: Bearer <your key>`, and map your
   POS fields into the JSON body.
3. Set the Zap's schedule (e.g. weekly) to push each period's numbers.

## Setup / enabling

- Run migration **`supabase/migrations/0029_api_keys.sql`** in Supabase to create
  the key store.
- Keep keys secret. Anyone with a key can read and write that organization's data;
  revoke immediately if one is exposed.

## Not in v1 (easy follow-ups)

- Menu sync endpoint (`/api/v1/menu`).
- Per-key rate limiting and read-only vs read-write scopes.
- A branded Zapier app (v1 uses Zapier's generic Webhooks action).
