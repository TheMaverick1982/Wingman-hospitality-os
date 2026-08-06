-- Let owners hide specific team members from the guest survey's "who took care
-- of you?" dropdown — e.g. marketing or catering staff who hold a manager role
-- but never interact with guests. Additive; defaults to shown.
alter table staff_members add column if not exists exclude_from_survey boolean not null default false;
