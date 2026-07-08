-- Same 'wingman' vs 'custom' distinction as department_standards/department_training_items:
-- re-running the AI hiring-criteria builder only replaces its own previous
-- output for that department, never a manually added/edited trait.
alter table hiring_traits add column source text not null default 'custom' check (source in ('wingman', 'custom'));
