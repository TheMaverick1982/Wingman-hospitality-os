# Database migrations

SQL migrations live in `supabase/migrations/` as ordered files (`0001_...sql`,
`0002_...sql`, …). They must be applied to the Supabase database for the matching
app code to work. This used to be done by hand in the SQL editor, which is how a
few migrations lagged behind a deploy and made data _look_ missing. That's now
automated.

## How it works

- **`scripts/apply-migrations.sh`** applies every migration not yet recorded, in
  order, each inside a single transaction, and records each one in
  `public.schema_migrations_applied`. Already-applied files are skipped, so it's
  safe to run on every deploy.
- **`.github/workflows/migrate.yml`** runs that script automatically whenever a
  file under `supabase/migrations/` changes on the production branch, and can also
  be run on demand from the **Actions** tab. It uses the same `SUPABASE_DB_URL`
  secret as the nightly backup.

Because the app's queries are written to degrade gracefully when a new column is
missing (guarded/isolated reads), a brief gap between a deploy and its migration
no longer breaks anything — but this keeps that gap near-zero.

## One-time setup on the existing database

The production database already has migrations `0001`–`0091` applied (by hand), but
the new ledger table doesn't know that yet. Baseline it **once** so CI doesn't try
to re-run them:

1. Open the Supabase **SQL editor**.
2. Paste and run **`scripts/baseline-migrations.sql`**. It creates
   `public.schema_migrations_applied` and marks all current migrations as applied.
   (Safe to run more than once.)

After that, the workflow only ever runs genuinely new migrations.

## Requirements

- Repo secret **`SUPABASE_DB_URL`** — the Session pooler connection string
  (port 5432), under **Settings → Secrets and variables → Actions**. (Already set
  if the nightly backup is running.)
- The branch in `migrate.yml` (`on: push: branches:`) must match Vercel's
  **Production Branch** (Vercel → Project → Settings → Git). Update that one line
  if it differs.

## Adding a migration

1. Add a new numbered file to `supabase/migrations/` (e.g. `0092_...sql`).
2. Prefer idempotent DDL (`add column if not exists`, `create table if not
   exists`) so a manual/partial run is harmless.
3. Merge to the production branch — the workflow applies it automatically.

**Caveat:** a migration using `CREATE INDEX CONCURRENTLY` can't run inside a
transaction. Apply that one by hand and add its filename to
`schema_migrations_applied`, or keep it in its own file and run it manually.
