-- Adds real tracking for two design_v2 Guest Bounce Back features:
-- "Reactions created" (per-visit reaction: guests remember how you made
-- them feel, not the transaction) and "Raving fans" (referral tracking).

create type visit_reaction as enum ('wowed', 'delighted', 'neutral', 'let_down');

alter table guest_visits add column reaction visit_reaction;
alter table guests add column referred_a_friend boolean not null default false;
