-- Corporate / HQ team members: not tied to a physical location. Access-wise
-- they behave like an all-locations member (all_locations = true, location_id
-- null), but this flag lets us LABEL them as "Corporate" (rather than a made-up
-- home store) and skip the required-location step when inviting them. Pair with
-- profiles.section_overrides to scope a corporate person to just their area.
-- Additive, non-null with a default so existing rows are unaffected.
alter table profiles add column if not exists is_corporate boolean not null default false;
