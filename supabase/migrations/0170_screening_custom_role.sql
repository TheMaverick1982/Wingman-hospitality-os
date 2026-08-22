-- Let screening questions target a custom job role (department = 'Other'), not
-- just a standard department. A custom role is identified by its name, so two
-- distinct custom roles (e.g. "Baker" and "Valet") each get their own screening
-- set instead of colliding under the single "Other" enum value.
--
-- Standard-role questions keep custom_role = null (matched by department alone);
-- custom-role questions carry the role name here and are matched by
-- (department = 'Other', custom_role = <name>). Additive and nullable, safe for
-- existing rows.
alter table screening_questions add column if not exists custom_role text;

create index if not exists screening_questions_org_custom_idx
  on screening_questions(org_id, department, custom_role, sort_order);

notify pgrst, 'reload schema';
