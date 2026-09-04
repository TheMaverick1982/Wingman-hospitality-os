-- Structured address parts on locations. We already keep a single free-text
-- `address`, but Google's JobPosting markup wants city / state / postal code as
-- separate fields. Storing them structured (instead of parsing the free-text line
-- every time) makes the career-page JobPosting reliably complete and clears the
-- Search Console "missing addressLocality/addressRegion/postalCode" warnings.
-- Additive, nullable columns — existing rows keep working (the JobPosting builder
-- falls back to parsing the free-text address until these are filled in).
alter table locations add column if not exists city text;
alter table locations add column if not exists state text;
alter table locations add column if not exists postal_code text;
