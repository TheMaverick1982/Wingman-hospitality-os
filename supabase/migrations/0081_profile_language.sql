-- Per-user language preference. Null = not yet chosen (we prompt on first
-- login and default the UI to English until they pick). Staff who speak
-- Spanish can switch and do their training/tests in their language.
alter table profiles add column if not exists preferred_language text;

alter table profiles
  drop constraint if exists profiles_preferred_language_check;
alter table profiles
  add constraint profiles_preferred_language_check
  check (preferred_language is null or preferred_language in ('en', 'es'));
