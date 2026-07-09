-- Support tickets between customers (org users) and the Wingman platform team.
--
-- Customers file tickets from inside the app; platform admins manage them all
-- from /admin (server-side, via the service-role client — no is_platform_admin
-- RLS function needed, matching the rest of the admin area).
--
-- Visibility on the customer side: the person who filed it, plus their org's
-- Super Admins and Managers (is_manager_or_above), scoped to their own org.

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  subject text not null,
  -- open   = awaiting the support team
  -- pending = support replied, awaiting the customer
  -- closed = resolved
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index support_tickets_org_idx on support_tickets(org_id, last_activity_at desc);
create index support_tickets_status_idx on support_tickets(status, last_activity_at desc);

create table support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  from_support boolean not null default false, -- true = reply from the Wingman team
  body text not null,
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_idx on support_ticket_messages(ticket_id, created_at);

alter table support_tickets enable row level security;
alter table support_ticket_messages enable row level security;

-- A ticket is visible to its creator and to managers/owners of the same org.
create policy support_tickets_select on support_tickets for select
  using (org_id = current_org_id() and (created_by = auth.uid() or is_manager_or_above()));

-- Anyone in the org can file a ticket (as themselves).
create policy support_tickets_insert on support_tickets for insert
  with check (org_id = current_org_id() and created_by = auth.uid());

-- The creator or a manager/owner can update the ticket (e.g. close/reopen).
create policy support_tickets_update on support_tickets for update
  using (org_id = current_org_id() and (created_by = auth.uid() or is_manager_or_above()))
  with check (org_id = current_org_id() and (created_by = auth.uid() or is_manager_or_above()));

-- Messages are visible on any ticket the caller can see.
create policy support_messages_select on support_ticket_messages for select
  using (
    exists (
      select 1 from support_tickets t
      where t.id = support_ticket_messages.ticket_id
        and t.org_id = current_org_id()
        and (t.created_by = auth.uid() or is_manager_or_above())
    )
  );

-- Customers can add their own (non-support) messages to a ticket they can see.
-- Support-team replies (from_support = true) are inserted via the service-role
-- client from the admin area, which bypasses RLS.
create policy support_messages_insert on support_ticket_messages for insert
  with check (
    from_support = false
    and author_id = auth.uid()
    and exists (
      select 1 from support_tickets t
      where t.id = ticket_id
        and t.org_id = current_org_id()
        and (t.created_by = auth.uid() or is_manager_or_above())
    )
  );
