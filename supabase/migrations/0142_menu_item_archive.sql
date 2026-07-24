-- Archive (soft-delete) for menu items, so removing a dish from the active menu
-- doesn't destroy it — or its recipe. Archived dishes drop out of the menu but
-- stay in the database (with their recipe_steps intact) and can be restored,
-- bringing the dish and its "how to cook it" back together. Only a deliberate
-- permanent delete actually removes the row (which cascades to the recipe).
alter table menu_items add column if not exists archived_at timestamptz;
create index if not exists menu_items_active_idx on menu_items (org_id, department) where archived_at is null;
