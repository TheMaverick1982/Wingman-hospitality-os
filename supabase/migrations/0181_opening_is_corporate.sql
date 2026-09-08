-- Corporate / not-location-specific job openings. Some roles a group hires for
-- aren't tied to any one restaurant (a corporate marketer, a regional ops lead,
-- an HQ bookkeeper). Those openings carry no location_id, but "All locations"
-- (also null location_id) wrongly reads as "hiring at every store" — so this flag
-- lets a null-location opening be labeled and grouped as "Corporate" instead.
-- Additive, non-null with a default so existing openings are unaffected.
alter table job_openings add column if not exists is_corporate boolean not null default false;
