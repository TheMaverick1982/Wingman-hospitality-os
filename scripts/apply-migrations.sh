#!/usr/bin/env bash
#
# Applies any not-yet-applied Supabase migrations (supabase/migrations/*.sql) to
# the database at $SUPABASE_DB_URL, in filename order, each inside a single
# transaction, recording each applied file in public.schema_migrations_applied so
# it runs exactly once. Already-applied files are skipped, so this is safe to run
# repeatedly (and on every deploy).
#
# ONE-TIME setup on an existing database: run scripts/baseline-migrations.sql once
# in the Supabase SQL editor first, so migrations already applied by hand are
# marked done and never re-run.
#
# NOTE: a migration that uses CREATE INDEX CONCURRENTLY cannot run inside a
# transaction — apply that one by hand and add its filename to
# schema_migrations_applied, or split it out. Everything else is transactional.

set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG_DIR="$ROOT/supabase/migrations"

# Ledger of what's been applied. Created on first run (or by the baseline script).
# RLS is enabled with no policies so this internal table is inaccessible via the
# API; the migrator connects as the DB owner and bypasses RLS.
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c "
  create table if not exists public.schema_migrations_applied (
    filename text primary key,
    applied_at timestamptz not null default now()
  );
  alter table public.schema_migrations_applied enable row level security;"

# Read the whole ledger once into a set, then diff in memory — one connection
# instead of one per file. (Applying a genuinely-new migration still opens its
# own connection, but that's rare; the common case is zero new migrations.)
declare -A APPLIED
while IFS= read -r name; do
  [ -n "$name" ] && APPLIED["$name"]=1
done < <(psql "$SUPABASE_DB_URL" -tAc "select filename from public.schema_migrations_applied")

applied=0
shopt -s nullglob
for path in "$MIG_DIR"/*.sql; do
  name="$(basename "$path")"
  if [ -n "${APPLIED[$name]:-}" ]; then
    continue
  fi
  echo "Applying $name"
  # Run the migration and record it in the SAME transaction, so a failure rolls
  # back both — the migration is never half-applied or wrongly marked done.
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
    -f "$path" \
    -c "insert into public.schema_migrations_applied(filename) values ('$name');"
  applied=$((applied + 1))
done

echo "Done. Applied $applied new migration(s)."
