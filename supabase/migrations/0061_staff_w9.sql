-- W-9 collection for paid staff (sales reps / contractors).
--
-- When a rep is added, the owner sends them the IRS W-9 to complete and return;
-- the signed form is stored privately and its status shows on the Team page.
-- The form itself holds a TIN/SSN, so it lives in a PRIVATE storage bucket —
-- reads/writes go through the service-role admin client (which bypasses storage
-- RLS), and the app verifies the caller has Team access.

-- Private bucket for returned W-9 files (safe to re-run).
insert into storage.buckets (id, name, public)
values ('tax-forms', 'tax-forms', false)
on conflict (id) do nothing;

-- W-9 tracking on the staff profile.
alter table profiles
  add column if not exists w9_status text not null default 'none'
    check (w9_status in ('none', 'requested', 'received')),
  add column if not exists w9_requested_at timestamptz,
  add column if not exists w9_received_at timestamptz,
  add column if not exists w9_file_path text;
