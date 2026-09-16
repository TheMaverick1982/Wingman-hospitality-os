-- Cost per plate: what a dish costs to make. Lets an owner enter the plate cost
-- on a recipe and have Wingman derive the profit (price - plate cost) that feeds
-- the menu-engineering quadrant — instead of computing gross profit by hand.
-- Deliberately a single number per dish, NOT an ingredient/inventory costing
-- module. Additive and nullable; existing items and their profit numbers stand.
alter table menu_items add column if not exists plate_cost numeric;
