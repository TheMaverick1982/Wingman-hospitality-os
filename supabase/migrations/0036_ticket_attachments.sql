-- Attachments (screenshots / PDFs) on support tickets, both directions.
--
-- Files live in a PRIVATE Supabase Storage bucket; the DB only stores a
-- reference. All storage reads/writes go through server actions using the
-- service-role client (which bypasses storage RLS), so the bucket needs no
-- storage policies — access is mediated by the app, which verifies the caller
-- can see the ticket and hands back short-lived signed URLs.

-- Private bucket (safe to re-run).
insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', false)
on conflict (id) do nothing;

create table ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  message_id uuid references support_ticket_messages(id) on delete set null,
  storage_path text not null,
  filename text not null,
  content_type text not null,
  size_bytes integer not null,
  uploaded_by uuid references profiles(id) on delete set null,
  from_support boolean not null default false,
  created_at timestamptz not null default now()
);

create index ticket_attachments_ticket_idx on ticket_attachments(ticket_id, created_at);

alter table ticket_attachments enable row level security;

-- Visible on any ticket the caller can see (mirrors the messages policy). Rows
-- are inserted by server actions (service role) after authorization.
create policy ticket_attachments_select on ticket_attachments for select
  using (
    exists (
      select 1 from support_tickets t
      where t.id = ticket_attachments.ticket_id
        and t.org_id = current_org_id()
        and (t.created_by = auth.uid() or is_manager_or_above())
    )
  );
