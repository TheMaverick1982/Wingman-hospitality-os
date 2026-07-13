-- A catch-all copy list for application notifications: in addition to the
-- location's email on file, every new application is also copied to these
-- addresses (comma-separated). Lets an owner/office always get a copy.
alter table organizations add column if not exists applications_cc text not null default '';

-- Public bucket for org logos shown on the (public) application form.
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;
