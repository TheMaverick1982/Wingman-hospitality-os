-- Owner's Mindset: the culture core — the "run it like you own it" frame that
-- everything else in Wingman leans on. A short, staff-facing manifesto the owner
-- can edit (and regenerate with AI). Additive: a text column with a strong
-- default so every workspace has something real from day one, backfilled for
-- existing orgs, and shown as a starting point until the owner makes it theirs.
alter table organizations add column if not exists owner_mindset text;

update organizations
set owner_mindset =
'Run it like you own it. Imagine you put your own savings into this place — the lease, the ovens, the payroll, all of it. Every guest who walks in is the reason the doors stay open. Every shift is your name on the sign.

You wouldn''t rush a table if it were your money on the line. You wouldn''t walk past a spill in your own dining room, let a regular leave unhappy, or send out a plate you weren''t proud of. You''d sweat the small stuff, because the small stuff is what makes people come back.

That''s the standard here: treat every guest, every plate, and every shift like the business is yours — because how we treat this place is exactly how our guests decide whether to return.'
where owner_mindset is null;
