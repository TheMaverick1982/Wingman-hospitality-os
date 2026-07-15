# Partners (B2B / Community) — Build Plan

> **Status:** Approved for build. Not yet implemented. This document is the
> agreed scope; work begins from here.
>
> **One-liner:** A lightweight relationship CRM built into Wingman that helps
> each store's manager systematically nurture the businesses around them — so
> catering, group lunches, private events, happy-hour buyouts, and fundraisers
> become a repeatable, measured habit instead of luck. Bounce Back wins back
> *guests*; Partners wins *businesses*.

---

## 1. Naming & placement

- **Nav label:** **"Partners"**, subtitle "Local partners & community."
- Internal / marketing name: "B2B Partnerships."
- Lives in the main app nav alongside Bounce Back.

## 2. Access & visibility (roles)

Uses the existing 3-tier `access_role` model (`super_admin` / `manager` /
`staff`) and the `current_access_role()` RLS helper.

| Role | Partners access |
|---|---|
| **super_admin** (account owner) | **Full org visibility** — every location, every contact, every manager's activity. All-Locations aggregate + drill into any store. Authors goals. Receives Leadership Rollup. |
| **manager** | Scoped to the location(s) they're assigned to. A manager can oversee **multiple stores**. Sees and works only their assigned locations' contacts/activities. Receives a monthly Hit List for each store they own. |
| **staff** (and `shift_lead`) | **No access.** Hidden in nav, blocked at the data layer. |

**Multi-location managers (reuses existing infra):** the app already supports
managers who oversee several stores — `profiles.all_locations`, the
`profile_locations` join table, and the `can_access_location()` RLS helper (which
already checks super_admin ∪ all_locations ∪ home `location_id` ∪
`profile_locations`). The owner already assigns a manager to "All" or "Specific
locations" in the team invite/edit forms (backed by `assign_team_member_profile`).
So Partners needs **no new access table** — every Partners query just gates on
`can_access_location(location_id)` and inherits full multi-location support.

Enforced in two places so it can't leak:
1. **Nav** hides the module for staff/shift_lead (via the permissions matrix).
2. **Supabase RLS** on every Partners table scopes to org +
   `can_access_location(location_id)`; `super_admin` bypasses the location filter
   and sees the full org. Owner "see everything" is a database-level rule.

## 3. Data model (migration 0100)

Four tables. Money stored as integer cents (matches billing/pricing code).

### `partner_contacts`
`id`, `organization_id`, `location_id` (nullable = org-wide), `company_name`
(req), `contact_name`, `title`, `email`, `phone`, `category`, `subcategory`,
`website`, `address`, `notes`, `status` (`active`/`archived`), `created_by`,
`created_at`, `updated_at`, **`last_activity_at`** (denormalized).

> **Key decision — denormalize `last_activity_at` onto the contact** via a DB
> trigger (same pattern as the existing pricing trigger). The Fading-Connections
> KPIs and the default "Needs Follow-up First" sort both key off *days since last
> activity*; a denormalized indexed column makes the whole grid + sort read one
> column instead of a per-row subquery.

### `partner_activities`
`id`, `organization_id`, `contact_id`, `location_id` (copied from contact for
fast rollups), `activity_date` (date), `activity_type`, `notes`,
`revenue_cents` (nullable), `created_by`, `created_at`.

`activity_type` values: **Called/Texted, Emailed, Meeting, Event Booked,
Fundraiser Booked.** First three reset the "warm" clock; the last two also count
toward goals and carry actual revenue.

> **Key decision — Event Booked / Fundraiser Booked are first-class activity
> types**, not notes, so goal counts are a simple `count(*) where activity_type
> = …` for the quarter.

### `partner_goals`
Per (location, year, quarter) targets: `goal_new_contacts`, `goal_events`,
`goal_fundraisers`, `goal_active_connections`. Org-wide default + per-location
override (only stores that differ get a row). Authored by super_admin.

> **Multi-store managers:** no new table — reuses the existing
> `profile_locations` + `all_locations` + `can_access_location()` infrastructure
> and the team invite/edit "Specific locations" UI (see §2).

### `partner_metrics_snapshots`
Frozen per (location, year, quarter): `total_contacts`, `new_contacts`,
`active_connections`, `events_booked`, `fundraisers_booked`, `revenue_cents`,
`snapshot_at`. Written once at quarter close by the cron. Live dashboard reads
from activities (always accurate); the "Prior Years" archive tab reads snapshots
(instant, frozen).

## 4. Screens

**Header:** title + subtitle; **Location switcher** ("All Locations ▾", super_admin
only sees all; manager sees their store). In All-Locations mode each card shows
a location pin badge; hidden when one store is selected. Primary buttons
(mobile-stacked like Bounce Back): **+ Add Contact · Log Activity · 📷 Scan Card**.

**KPI cards:** Total Contacts · Active Connections (30d) · Fading Connections
(30+d / never) · Actual Revenue (quarter) · Q_ Growth (new vs goal) · Community
Events (vs goal) · Fundraisers (vs goal). Cards are **clickable filters**.

**Tab — Contacts:** card/table list. Row shows company, contact, category chip,
location badge (all-locations mode), last-touched relative time, an orange
**"Needs Follow-up"** badge at 30+ days / never, and a quick **Log Call/Text**
icon that resets the clock in one tap. Sort dropdown defaults to **"Needs
Follow-up First."**

**Tab — Activity Feed:** reverse-chronological log across contacts (respects
location filter). Each entry: who/what/when, revenue if any, and the manager who
logged it (`created_by`) — doubles as the owner's oversight view.

**Log-Activity slide-out (Sheet):** Select Contact → Activity Type → Date
(default today) → Revenue (optional, cents) → Notes → **☐ Create a follow-up
task?** → date picker + task notes → writes a row into the **existing
scheduled-reminders table**, linked to the contact. If a Meeting/Event is logged
with no follow-up, show a soft "remind me in 2 weeks?" one-tap hint.

## 5. Scan Business Card (📷) — step 3.5

Third entry point on the Contacts tab.

**Flow:** Scan Card → camera → Claude reads it → **Add Contact** slide-out opens
**pre-filled** → manager confirms/fixes → Save. Zero new tables — just a faster
way to create a `partner_contacts` row.

- **Capture:** native app uses Capacitor's camera plugin; mobile web uses the
  browser camera picker (`<input capture="environment">`). Detect environment,
  pick the right one — works everywhere.
- **Extract:** image → `claude-opus-4-8` (vision) with a structured-output
  schema returning `{ company_name, contact_name, title, email, phone, website,
  address }`, mapped onto `partner_contacts`. Reuses the existing Anthropic
  integration — no new OCR vendor, no new infra. ~pennies per scan.
- **No file retention:** the photo is sent to Claude for extraction only and is
  **never stored** — not in Supabase storage, not on disk. It lives in memory
  for the single extraction request and is discarded. Only the parsed text
  fields persist.
- **Mandatory confirm:** the scan **never auto-populates**. Extracted fields open
  the Add Contact form pre-filled; the manager reviews/edits and must explicitly
  Save before anything is written.
- **"How you met" note:** the confirm form includes a short note field ("How you
  met / context") that saves into the contact's `notes` — captures the human
  detail (met at chamber mixer, referred by X) right when the card is scanned.

## 6. Goals — set by the Account Owner in Settings

Only **super_admin** sets goals, in **Settings → Partners Goals**, as *how many
per quarter* for each metric:

| Setting | Meaning |
|---|---|
| **New Contacts / quarter** | new `partner_contacts` per store per quarter |
| **Community Events / quarter** | `event_booked` activities per store per quarter |
| **Fundraisers / quarter** | `fundraiser_booked` activities per store per quarter |
| **Active Connections target** | contacts each store keeps warm (touched ≤30d) |

Owner sets one **org-wide default** (four numbers) + optional **per-location
override**. Customer-editable, so these columns must **not** be on the
pricing-protection trigger. Targets carry forward each year; quarter counters
reset because live numbers are always "this quarter's date window."

## 7. Revenue

**Actual booked revenue, entered after the event.** Because revenue lands after
the event happens: when an Event/Fundraiser Booked activity's `activity_date`
has passed and `revenue_cents` is null, flag it ("Add revenue") on the row and
in the monthly report so the Actual Revenue card stays honest.

## 8. Reports (cron: 1st of month, 8am)

Two emails, two jobs — nobody gets everything.

**A. Leadership Rollup** → account owner + configurable **`partners_report_email`**
(accounting/HR/leadership; falls back to owner email if unset; customer-editable,
not on the pricing trigger). All-store comparison table: each location's goal
progress, revenue, and **fading count**, sorted so lagging stores surface at
top. **No per-contact Hit List** — the scoreboard, not 200 names.

**B. Manager Store Report** → each manager, **their store only**: their metrics +
goal progress + **Hit List** (specific fading/never-touched contacts to call this
week, stalest first) + "needs revenue entered" list. Routed by location
assignment — a manager over multiple stores gets their stores stacked; no
special GM case needed now.

Daily follow-up nudges already ride the existing `send-scheduled-reminders`
cron, so the monthly report stays a strategic recap, not a nag.

**Quarter close:** on the first monthly run of a new quarter (Jan/Apr/Jul/Oct 1),
the same cron freezes the prior quarter into `partner_metrics_snapshots` before
the new counters start.

## 9. Quarterly accumulation & yearly archive

- **Live numbers** = sum/count of `partner_activities` where `activity_date` in
  [quarter start … now]. No counter to drift — the date window *is* the quarter;
  it "resets" because the window moves.
- **Goal progress** = live count ÷ `partner_goals` target for current (year,
  quarter).
- **Archive** ("Prior Years" tab) reads `partner_metrics_snapshots`, grouped by
  year → quarter. Instant, frozen, audit-friendly.

## 10. Ties into existing systems

- **Follow-up tasks / reminders** — NOTE (found during build): there is no single
  generic "scheduled-reminders" table or `send-scheduled-reminders` cron. The
  codebase uses a **per-feature cron** pattern (each under `src/app/api/cron/*`:
  interview-reminders, test-reminders, commission-reminders, …) plus the shared
  `notifications.ts` on/off registry and `sendEmail`. So follow-up tasks will get
  a dedicated `partner_follow_ups` table + a `partners-followups` cron that emails
  the assigned manager when one is due — same shape as every other reminder here.
  Built in PR 2/3 (see revised build order). Small deviation from the plan's
  wording, same outcome.
- **Bounce Back patterns** — KPI grid, responsive list/card layout, mobile
  ordering fix, activity-logging muscle memory reused wholesale.
- **Admin CRM (`/admin/crm`)** — that's the *platform* pipeline (Wingman → restaurants).
  Partners is the *restaurant's* pipeline (restaurant → local businesses). Same
  shape, different tenant level; lift styling, keep separate (RLS-scoped to org).
- **Anthropic integration** — Scan Card reuses the existing Claude wiring.
- **Location model** — reuses org/location scoping + All-Locations aggregate.

## 11. Companion updates (per AGENTS.md — same change as the feature)

1. **Help Center** (`help-content.ts`) — new "Partners" article (+ screenshots to embed).
2. **AI doctrine** (`ai-doctrine.ts`) — community-partnership knowledge.
3. **Sales playbook** (`sales-playbook.ts`) — add to `PRODUCT_TOUR` + a demo movement/reframe.
4. **Marketing site** — new Partners feature section.
5. **Demo account** (`wingmandemo@gmail.com`) — seed ~15–20 contacts across
   categories, mixed-freshness activities (several deliberately stale for the
   Fading/Hit-List demo), a couple booked events/fundraisers with revenue, and
   goals set for partial-fill progress cards (mirror reference: ~$7,239 revenue,
   3/20 growth, etc.).

---

## Build order → commits / PRs

Grouped into ~4 PRs so each merges clean and Vercel deploys in reviewable chunks.

**PR 1 — Foundation & Contacts**
1. Migration 0100: 4 Partners tables + `last_activity_at` trigger + RLS
   (org + `can_access_location()`; super_admin full org). Multi-store manager
   access reuses existing `profile_locations` — no new access table.
2. Nav entry (role-gated: super_admin + manager; hidden from staff/shift_lead).
   Owner already assigns managers to multiple stores via existing team settings.
3. Contacts tab: list, add/edit, location scoping, KPI cards.
4. Log-Activity slide-out + `last_activity_at` denormalization + quick Log Call/Text.

**PR 2 — Follow-up loop & Feed**
5. Scan Card (camera + Claude vision → pre-filled Add Contact).
6. Fading logic, "Needs Follow-up" badge, default sort, clickable KPI filters.
7. Follow-up tasks → existing reminders cron (`partner_contact_id` link).
8. Activity Feed tab.

**PR 3 — Goals & Reports**
9. Partners Goals in Settings (super_admin only; per-quarter per metric; org
   default + per-store override) + goal-progress cards + `partners_report_email`.
10. Monthly report cron: Leadership Rollup + per-manager Hit List + revenue-needed
    flag + quarter-close snapshot + "Prior Years" archive tab.

**PR 4 — Docs, sales, demo**
11. Help article, AI doctrine, Sales playbook (`PRODUCT_TOUR`), marketing section,
    demo/dummy-account seed.

---

## Settled decisions (for reference)

- Name: **Partners** / community.
- Access: **super_admin + manager**; **staff hidden**. Managers see only their
  assigned location(s) — **multi-store managers supported** via `manager_locations`;
  owner sees all locations, contacts, and managers.
- Goals: **owner-set in Settings**, per-quarter per metric, org default + per-store override.
- Scan Card: **yes**, step 3.5, camera + Claude vision.
- Revenue: **actual booked**, entered after the event, with a nudge to enter it.
- Reports: **leadership rollup** (owner + report email) vs. **per-manager Hit
  List**, routed by location assignment.
