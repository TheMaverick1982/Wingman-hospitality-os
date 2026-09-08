-- Let an opening be "unlisted": still open and shareable by its own direct link
-- (/careers/<slug>/<openingId>), but hidden from the public careers hub and from
-- the sitemap/search. Default true = every existing and new opening shows on the
-- careers page as before, until the owner chooses to exclude it. Additive.
alter table job_openings add column if not exists list_on_careers boolean not null default true;
