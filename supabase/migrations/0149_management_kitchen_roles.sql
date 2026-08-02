-- Add common management, kitchen, and counter roles so restaurants can staff,
-- train, and hire for the positions the original built-ins missed (most
-- immediately: Kitchen Manager). app_department is an enum used across ~9
-- tables, so we extend it in place — values can't be removed, but these are all
-- broadly useful. Starter content for each is seeded at activation time from
-- ROLE_SEED (src/lib/role-seed.ts), never here, so this stays purely additive.
-- Safe to re-run.
alter type app_department add value if not exists 'Cashier';
alter type app_department add value if not exists 'Sous Chef';
alter type app_department add value if not exists 'Prep Cook';
alter type app_department add value if not exists 'Kitchen Manager';
alter type app_department add value if not exists 'Assistant Manager';
