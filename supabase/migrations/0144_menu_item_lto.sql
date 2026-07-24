-- Limited Time Offer flag. LTO / monthly-special dishes rotate constantly, so
-- they get their own pinned "Limited Time Offers" section on the menu instead of
-- sitting in a standing category. A simple manual on/off toggle per dish — a dish
-- keeps its normal category, so clearing the flag drops it right back where it
-- belongs.
alter table menu_items add column if not exists is_lto boolean not null default false;
create index if not exists menu_items_is_lto_idx on menu_items(org_id, is_lto) where is_lto;
