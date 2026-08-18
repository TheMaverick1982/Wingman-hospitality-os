-- Multi-role staff: a staff member can hold more than one role (e.g. Host +
-- Server) when their work overlaps. `department` stays the PRIMARY role for
-- back-compat and for the single-value places that still key off it (sign-offs,
-- the survey picker); `additional_departments` holds any EXTRA roles. A staff
-- member's effective role set is department + additional_departments (deduped),
-- which drives which training, menu, tests, and checklists they see.
--
-- Stored as text[] to match custom_checklists.departments (the other
-- role-array column), so the same containment operators work across both.
-- Additive and non-destructive: existing rows default to no extra roles.
alter table staff_members
  add column if not exists additional_departments text[] not null default '{}';

-- Refresh PostgREST's cached schema so the new column is selectable immediately.
notify pgrst, 'reload schema';
