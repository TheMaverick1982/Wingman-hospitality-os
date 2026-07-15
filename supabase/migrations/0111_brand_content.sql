-- Franchise Phase 2: brand content push-down + lock.
--
-- The franchisor authors a training test in their own org, then pushes copies to
-- every franchisee. A LOCKED copy is a brand standard the franchisee can use but
-- not edit; the franchisor can re-push updates. Enforcement is at the DB level
-- (triggers) so every edit path is covered, not just the UI.

-- Denormalized flags on the franchisee's local copy — fast to read for the UI
-- and the lock triggers.
alter table tests
  add column if not exists brand_locked boolean not null default false,
  add column if not exists brand_group_id uuid references franchise_groups(id) on delete set null;

-- Mapping from a franchisor's source test to each franchisee's local copy, so a
-- re-push updates the right rows. Deny-all RLS (service-role only).
create table if not exists brand_content_links (
  group_id uuid not null references franchise_groups(id) on delete cascade,
  content_type text not null default 'test',
  source_id uuid not null,          -- the franchisor's canonical test
  org_id uuid not null references organizations(id) on delete cascade,  -- the franchisee
  local_id uuid not null,           -- the franchisee's copy
  locked boolean not null default true,
  last_pushed_at timestamptz not null default now(),
  primary key (group_id, content_type, source_id, org_id)
);
alter table brand_content_links enable row level security;

-- Block edits to a brand-locked test by anyone but the service-role client
-- (auth.uid() is null for service role — the franchisor's push path).
create or replace function block_brand_locked_test() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(old.brand_locked, false) then
    raise exception 'This is a brand-standard test set by your franchisor and can''t be changed here.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists block_brand_locked_test on tests;
create trigger block_brand_locked_test before update or delete on tests
  for each row execute function block_brand_locked_test();

-- Same protection for the test's days and questions (insert/update/delete).
create or replace function block_brand_locked_test_child() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  locked boolean;
begin
  if auth.uid() is not null then
    select brand_locked into locked from tests where id = coalesce(new.test_id, old.test_id);
    if coalesce(locked, false) then
      raise exception 'This is a brand-standard test set by your franchisor and can''t be changed here.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists block_brand_locked_test_days on test_days;
create trigger block_brand_locked_test_days before insert or update or delete on test_days
  for each row execute function block_brand_locked_test_child();
drop trigger if exists block_brand_locked_test_questions on test_questions;
create trigger block_brand_locked_test_questions before insert or update or delete on test_questions
  for each row execute function block_brand_locked_test_child();
