-- Menu items get a category / section (Appetizers, Salads, Mains, Desserts,
-- Cocktails, …) so servers and bartenders can browse a long menu grouped and
-- collapsed by section instead of one endless scroll. The AI menu parser fills
-- it in on upload — using the menu's own sections when it has them, and
-- inferring a sensible one per item when it doesn't. '' means uncategorized and
-- groups under "Other" in the UI. Additive and backward-compatible.
alter table menu_items add column if not exists category text not null default '';
