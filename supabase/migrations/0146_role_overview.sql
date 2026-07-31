-- Role overview: a short, staff-facing description of what a role is really
-- about — shown at the top of the "Your role" guide, above the role's
-- guest-experience standards and responsibilities. Per-org, per-department
-- (matches the department_meta key). Nullable; managers generate/edit it.
alter table department_meta add column if not exists description text;
