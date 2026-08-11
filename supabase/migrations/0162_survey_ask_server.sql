-- Org-level switch for the guest survey's "Who took care of you?" staff picker.
-- Some restaurants (counter-service, ghost kitchens, or owners who just don't want
-- reviews attributed to a person) want the whole field gone, not just specific
-- people hidden. Default on, preserving today's behavior. Per-person hiding stays
-- via staff_members.exclude_from_survey (migration 0153).
alter table organizations add column if not exists survey_ask_server boolean not null default true;
