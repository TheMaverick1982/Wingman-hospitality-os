-- Training sign-offs are per-location: a person is trained at the store they
-- work at, and a multi-location operator needs to see each location's training
-- completion on its own. training_signoffs only carried org_id, so the Training
-- page blended every location's completions and sign-off log together with no
-- way to scope to one store.
--
-- Add a nullable location_id (backfilled from the linked staff member) and index
-- it. NULL = an unscoped/legacy sign-off, shown under "All locations". Kept
-- nullable + "on delete set null" so deleting a location never drops the
-- training history.
alter table training_signoffs
  add column if not exists location_id uuid references locations(id) on delete set null;

-- Backfill existing rows from the staff member they were signed off for.
update training_signoffs t
set location_id = s.location_id
from staff_members s
where t.location_id is null
  and t.staff_id = s.id;

create index if not exists training_signoffs_location_id_idx on training_signoffs(location_id);
