-- Per-USER section visibility. An owner can hide individual sections from one
-- team member (a cleaner dashboard for a manager who doesn't need everything),
-- on top of the org-wide role defaults. Shape: { "<section>": "none" | "view" |
-- "full" } — typically { "growth": "none", "partners": "none", ... }. Null/empty
-- means "use the role defaults". Additive, nullable.
alter table profiles add column if not exists section_overrides jsonb;
