## Wingman

A multi-tenant hospitality operations platform: guest bounce-back tracking, service
recovery logging, culture & training standards, manager accountability checks, and
hiring scorecards — with a General Manager / Store Manager permission model enforced
by Supabase Row Level Security.

### Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com) — Postgres, Auth, and Row Level Security
- Deployed on [Vercel](https://vercel.com)

### Local setup

1. Copy `.env.example` to `.env.local` and fill in your Supabase project's URL and keys.
2. `npm install`
3. `npm run dev`

### Database

Schema and RLS policies live in `supabase/migrations/`. Apply them to your Supabase
project via the SQL Editor or `supabase db push`.

