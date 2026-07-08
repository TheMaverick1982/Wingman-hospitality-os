-- Distinguishes AI/upload-generated training content ('wingman') from items
-- a manager or owner typed in by hand ('custom'), so re-running the AI
-- training builder for a role only replaces its own previous output and
-- never wipes a manual edit.
alter table department_standards add column source text not null default 'custom' check (source in ('wingman', 'custom'));
alter table department_training_items add column source text not null default 'custom' check (source in ('wingman', 'custom'));
