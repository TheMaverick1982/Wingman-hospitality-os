-- Links a test back to the role whose training it was generated from, so the
-- "Turn this training into a test" button can find and update the same test
-- instead of creating duplicates.
alter table tests add column if not exists source_department text;
create index if not exists tests_source_department_idx on tests(org_id, source_department);
