-- Menu engineering: rank menu items by dollar contribution margin and
-- popularity to find the stars, plowhorses, puzzles, and dogs. One shared
-- menu per org (independents almost always run one menu), manager-or-above,
-- matching the other planning-sensitive sections -- hidden from Staff.

create table menu_engineering_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  food_cost numeric not null default 0,
  popularity smallint not null default 2 check (popularity between 1 and 3),
  sort_order int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index menu_engineering_items_org_id_idx on menu_engineering_items(org_id);

alter table menu_engineering_items enable row level security;

create policy menu_engineering_select on menu_engineering_items for select
  using (org_id = current_org_id() and is_manager_or_above());
create policy menu_engineering_write on menu_engineering_items for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());
