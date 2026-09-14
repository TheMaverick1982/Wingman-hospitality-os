-- Re-assert enum values that were added in PRE-BASELINE migrations (<= 0091).
--
-- The production DB was baselined (see MIGRATIONS.md) by MARKING 0001-0091 as
-- applied — not necessarily running each one. So a value added in that range can
-- be recorded as "applied" while never actually existing in the database, and the
-- auto-migrator skips it forever. That's exactly what happened to 'shift_lead'
-- (added in 0079): inviting a Shift Lead failed with
--   invalid input value for enum access_role: "shift_lead"
-- while 'developer' (added post-baseline in 0096) worked fine.
--
-- This migration is POST-baseline, so the auto-migrator runs it for real. Every
-- statement is `add value if not exists`, so it's a no-op where the value already
-- exists (e.g. departments that were hand-applied) and additive-only — it never
-- touches data. Postgres allows multiple ADD VALUE in one transaction as long as
-- none is USED in the same transaction (they aren't here); same pattern as 0067.

-- access_role: the Shift Lead tier (0079).
alter type access_role add value if not exists 'shift_lead';

-- app_department: the roles added in 0067 (also pre-baseline).
alter type app_department add value if not exists 'Busser';
alter type app_department add value if not exists 'Food Runner';
alter type app_department add value if not exists 'Barista';
alter type app_department add value if not exists 'Line Cook';
alter type app_department add value if not exists 'Dishwasher';
alter type app_department add value if not exists 'Expo';
alter type app_department add value if not exists 'Sommelier';
