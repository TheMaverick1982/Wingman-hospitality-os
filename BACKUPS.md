# Backups & data recovery

Two layers protect Wingman data. Layer 1 (app-level) is live now and costs
nothing. Layer 2 (PITR) is a paid Supabase plan feature to switch on once
paying clients justify it — nothing in the code needs to change to enable it.

## Layer 1 — App-level safety net (live now)

- **Soft deletes + Trash/restore** on the highest-value tables — a "delete"
  hides the row instead of destroying it, and an owner can restore it. So a
  disgruntled employee "deleting everything" is recoverable by the owner, in
  the app, with no support ticket.
- **Audit log** of destructive actions (who deleted/archived what, and when),
  so damage is traceable and reversible.
- **Fast offboarding** — an owner can revoke a departing employee's access and
  their API keys immediately from Settings → Team.

This is the day-to-day backstop. It does not protect against a full-database
disaster (that's Layer 2), but it fully covers the realistic "insider deletes
records" threat.

## Layer 2 — Point-in-Time Recovery (PITR) — enable when ready

PITR lets you restore the **entire database to any minute** in the retention
window (e.g., "5 minutes before the incident"). It is the ultimate backstop for
a full-scale disaster.

**It is a Supabase plan setting, not code.** There is nothing to build or
deploy — the app is already "ready." When you decide to turn it on:

### To enable (when you have paying clients)
1. Supabase Dashboard → your project → **Settings → Add-ons** (or
   **Database → Backups**).
2. Enable **Point-in-Time Recovery** (adds ~$100/mo; requires a Pro plan or
   higher). Choose a retention window (7 days is typical to start).
3. That's it — continuous backups begin immediately. No redeploy, no migration.

### To restore after an incident
1. Supabase Dashboard → **Database → Backups → Point in Time**.
2. Pick the exact timestamp just **before** the bad change.
3. Restore. Supabase provisions the database at that moment.
4. (Supabase performs an in-place restore; confirm the app reconnects and spot-
   check a few records afterward.)

### Until PITR is on
Supabase's plan already includes **daily backups** (coarser than PITR, but a
real fallback). Combined with Layer 1 above, that's solid interim coverage.

### Reminder
Turn PITR on the same week the first paying customer's data lands — that's the
moment the $100/mo is unambiguously worth it.
