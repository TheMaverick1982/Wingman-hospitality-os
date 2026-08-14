-- Let owners mark screening questions as required on the application form. Default
-- false (today's behavior — every screening question is optional). Per-question,
-- with a "require all" toggle in the UI on top.
alter table screening_questions add column if not exists required boolean not null default false;
