-- A "master" copy address (or several) for the guest-feedback report digest, in
-- addition to each location's own managers — mirrors organizations.applications_cc
-- for hiring. Comma/newline/semicolon-separated emails. Additive.
alter table organizations add column if not exists review_digest_cc text;
