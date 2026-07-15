# Launch / deploy checklist

Run through this before shipping anything to production. The guiding rule:
**never destroy client data, and never surprise a paying customer.**

## Data safety (the non-negotiables)
- [ ] `npm run check:migrations` passes (no catastrophic `DROP TABLE` / `TRUNCATE`
      / `DROP SCHEMA`). This also runs automatically in `prebuild`.
- [ ] Any new migration is **additive** — new tables/columns, not destructive
      ones. Column drops and deletes are reviewed and intentional.
- [ ] New user-facing deletes are **soft deletes** (`deleted_at` → Trash), not
      hard `DELETE`s.
- [ ] Recovery net is intact: soft-delete/Trash live (Layer 1) and, once on a
      paid Supabase plan, PITR enabled (Layer 2 — see `BACKUPS.md`).
- [ ] Secret/token tables stay deny-all RLS; no tokens selected to the browser.

## Correctness
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` succeeds ("Compiled successfully").
- [ ] `npm run test` (or the affected tests) pass.
- [ ] The changed flow was actually exercised, not just typechecked.

## Billing & pricing
- [ ] Price changes only affect new signups (existing orgs are grandfathered).
- [ ] No secret keys in code, commits, or the client bundle — env vars only.

## Docs in lockstep (for user-facing features)
- [ ] Help Center (`src/lib/help-content.ts`) updated.
- [ ] AI doctrine (`src/lib/ai-doctrine.ts`) updated if it adds product knowledge.
- [ ] Sales playbook (`src/lib/sales-playbook.ts`) updated.

## Third-party / integrations
- [ ] New integration secrets set in the deploy env (not chat), scoped to
      Production, and **redeployed** (env changes need a new deployment).
- [ ] Sandbox validated before flipping an integration to production.

When any item is uncertain or a change is irreversible, **stop and confirm with
the owner** before proceeding.
