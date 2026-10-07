-- Structured weekly availability on job applications: the applicant ticks the
-- shifts they can work (per day), or "anytime" if fully flexible. Stored as a
-- JSON array of "day:shift" cell ids (e.g. ["mon:evening","sat:morning"]) or
-- ["anytime"]. The existing free-text `availability` column stays and is kept in
-- sync with a readable summary, so cards/emails need no change. Additive.
alter table job_applications add column if not exists availability_shifts jsonb not null default '[]'::jsonb;
