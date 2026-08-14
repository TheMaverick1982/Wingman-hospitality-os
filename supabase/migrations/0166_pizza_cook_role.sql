-- Add "Pizza Cook" as a role. app_department is an enum used across many tables,
-- so we extend it in place (values can't be removed, but this is broadly useful).
-- Purely additive; starter content is seeded at activation time from ROLE_SEED
-- (src/lib/role-seed.ts), never here. Safe to re-run.
alter type app_department add value if not exists 'Pizza Cook';
