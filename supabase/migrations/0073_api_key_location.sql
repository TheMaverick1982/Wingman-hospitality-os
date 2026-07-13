-- Per-location API keys for multi-location operators. A key can be bound to one
-- location so the POS at each store uses its own key and every call is
-- automatically scoped to that store (reads filter to it, writes default to it).
-- NULL = an org-wide key (all locations), which can still scope a single request
-- with the X-Wingman-Location header. Existing keys stay org-wide.
alter table api_keys add column if not exists location_id uuid references locations(id) on delete cascade;
create index if not exists api_keys_location_id_idx on api_keys(location_id);
