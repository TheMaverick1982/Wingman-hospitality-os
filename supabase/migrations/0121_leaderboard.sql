-- Staff training leaderboard: an org-level on/off switch (default on). The board
-- itself is derived entirely from existing data (test results + sign-offs), so
-- no new tables are needed — just a flag so an owner can hide it from the floor.

alter table organizations add column if not exists leaderboard_enabled boolean not null default true;
