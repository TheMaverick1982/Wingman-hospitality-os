-- Team Playbook: org-specific guides / SOPs an owner writes for their own team.
--
-- Distinct from the product Help Center (which is the same for every customer
-- and maintained in code). These articles belong to ONE organization: everyone
-- in the org can read them; only a Super Admin can create/edit/delete them.

create table playbook_articles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  body text not null default '',
  sort_order integer not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index playbook_articles_org_idx on playbook_articles(org_id, sort_order);

alter table playbook_articles enable row level security;

-- Everyone in the org can read their org's playbook.
create policy playbook_select on playbook_articles for select
  using (org_id = current_org_id());

-- Only a Super Admin can write, and only within their own org.
create policy playbook_write on playbook_articles for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());
