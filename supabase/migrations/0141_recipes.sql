-- Kitchen recipes: a step-by-step "how to make it" for a dish, with an optional
-- real photo per step. Steps hang off a menu item (the dish). Managers/owners
-- build and edit them; kitchen (Chef) staff view them on the line. Photos live
-- in Supabase Storage — we keep only the object path here, never the image bytes.

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- The dish this step belongs to. Delete the dish → its recipe goes with it.
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  step_number smallint not null default 1,
  instruction text not null default '',
  -- Object path in the recipe-images bucket (e.g. "<org>/<item>/<step>.webp").
  -- Null = this step has no photo (photos are optional per step).
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipe_steps_item_idx on recipe_steps (menu_item_id, step_number);
create index recipe_steps_org_idx on recipe_steps (org_id);

alter table recipe_steps enable row level security;

-- Anyone in the org can read the recipes; the app gates who can *edit* (managers
-- and owners) at the action layer, exactly like menu items and training.
create policy recipe_steps_select on recipe_steps for select using (org_id = current_org_id());
create policy recipe_steps_write on recipe_steps for all
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- Public bucket for recipe step photos. Paths are per-org and unguessable, and
-- recipe photos aren't sensitive, so a public bucket keeps serving simple (plain
-- CDN URLs, no signed-URL expiry). All writes go through the service-role client
-- in server actions, so no storage RLS policy is needed for uploads.
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;
