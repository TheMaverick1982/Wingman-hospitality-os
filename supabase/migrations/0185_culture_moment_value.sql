-- Tie recognition to the org's real core values. A win/shout-out can now be
-- tagged with WHICH core value it reflects (value_id), so recognition rolls up to
-- the values the owner actually defined — not just the four generic hardcoded
-- tags. Additive and back-compatible:
--   * value_id is nullable and ON DELETE SET NULL (removing a value never breaks
--     an existing moment — it just loses the value link).
--   * the legacy `tag` enum is made nullable so a value-tagged moment doesn't
--     also need a generic tag; existing moments keep their tag untouched.
alter table culture_moments add column if not exists value_id uuid references core_values(id) on delete set null;
alter table culture_moments alter column tag drop not null;
