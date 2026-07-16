-- The Playbook: public content hub on the marketing site. Posts are drafted
-- (optionally by AI), reviewed, and published. Public visitors read published
-- posts; the admin manages everything via the service-role client.

create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  body text not null default '',              -- markdown-ish plain text
  category text not null default 'General',
  keywords text[] not null default '{}',
  status text not null default 'draft',       -- 'draft' | 'scheduled' | 'published'
  scheduled_for timestamptz,
  published_at timestamptz,
  facebook_posted_at timestamptz,
  views integer not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_idx on blog_posts(status, published_at desc);

-- Public read of PUBLISHED posts only. All writes happen via the service-role
-- client in platform-admin server code.
alter table blog_posts enable row level security;
create policy blog_posts_public_read on blog_posts for select using (status = 'published');
