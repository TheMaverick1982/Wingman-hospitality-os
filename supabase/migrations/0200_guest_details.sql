-- Guest-level "little details": the personal things worth remembering about a
-- guest as a person — an anniversary, a favorite dish, "drove three hours," a
-- kid's name — that persist across every visit (distinct from a single visit's
-- experience notes). Surfaced so the next visit can open by remembering them.
alter table guests add column if not exists details text not null default '';
