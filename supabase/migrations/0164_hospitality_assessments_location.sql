-- Scope the Hospitality Score by location. NULL location_id = the whole-company
-- assessment (the owner's overall read); a set location_id = that one location's
-- own score. This lets an owner take a company-wide score AND each location keep
-- its own, tracked separately over time. Additive and nullable, so every existing
-- assessment stays as a whole-company one.
alter table hospitality_assessments add column if not exists location_id uuid references locations(id) on delete cascade;

-- History/latest lookups filter by (org, location) and order by time.
create index if not exists hospitality_assessments_org_loc_idx
  on hospitality_assessments(org_id, location_id, created_at desc);
