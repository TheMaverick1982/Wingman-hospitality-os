-- Links a test back to the specific menu item (dish) whose recipe it was
-- generated from, so "Turn this recipe into a test" can find and update the same
-- test instead of creating duplicates. Distinct from source_department because a
-- single role (e.g. Chef) has many dishes, each with its own recipe test.
alter table tests add column if not exists source_menu_item_id uuid references menu_items(id) on delete set null;
create index if not exists tests_source_menu_item_idx on tests(org_id, source_menu_item_id);
