-- Per-org, editable copy for the two canned applicant replies ("we're
-- interested" / "not a good fit"). Null = use the built-in defaults. Shape:
-- { "interested": {"subject": "...", "body": "..."},
--   "not_a_fit":  {"subject": "...", "body": "..."} }
-- Additive, nullable column — no backfill, safe on live data.
alter table organizations add column if not exists application_reply_templates jsonb;
