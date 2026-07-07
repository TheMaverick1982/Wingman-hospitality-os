-- Structured menu items for Role Training (Server/Bartender menu upload ->
-- parsed dishes -> pairing/allergen/upsell training + menu-engineering
-- matrix). Replaces the old free-text menu_references field for
-- departments that have a menu.
--
-- popularity_pct/profit_amount drive the menu-engineering quadrant
-- (Stars/Puzzles/Plowhorses/Dogs) but genuinely need POS/sales data, so
-- they're nullable and entered manually - everything else (name,
-- description, price, allergens, pairing/upsell suggestions) is parsed
-- automatically from an uploaded menu via Claude.

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  department app_department not null,
  name text not null,
  description text not null default '',
  price numeric,
  allergens text not null default '',
  pairing_suggestion text not null default '',
  upsell_suggestion text not null default '',
  source text not null default 'wingman' check (source in ('wingman', 'custom')),
  popularity_pct smallint check (popularity_pct is null or popularity_pct between 0 and 100),
  profit_amount numeric,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index menu_items_org_dept_idx on menu_items(org_id, department);

alter table menu_items enable row level security;

create policy menu_items_select on menu_items for select using (org_id = current_org_id());
create policy menu_items_write on menu_items for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());
