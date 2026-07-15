# Franchise / multi-org architecture (proposed)

How Wingman supports a **franchisor** who wants every **franchisee** on the same
training, hiring, and standards — while each franchisee runs (and optionally
pays for) their own account.

Status: **proposal for review.** No code yet. This documents the model, the
data/roles/RLS design, the billing options, and a phased build plan.

---

## 1. The core idea — one new level above the org

Today the hierarchy is:

```
Organization  →  Locations
```

Franchise adds one level on top:

```
Franchise Group (franchisor)
    → Member Org (franchisee A)  → Locations
    → Member Org (franchisee B)  → Locations
    → Member Org (franchisee C)  → Locations
```

Each **franchisee is its own account** — own team, own logins, own guest data,
own billing — exactly like any standalone Wingman customer today. They're
**linked** under the franchisor, who becomes the "host" that sets the brand
standard and sees oversight across everyone, without running each franchisee's
day-to-day.

---

## 2. Roles & who can do what

The franchisee keeps a full owner experience; the franchisor gets a new
group-level role layered above.

| Role | Scope | Can do |
|---|---|---|
| **Franchisor Admin** (new, group level) | The whole franchise group | Author & push brand standards (training, hiring, journey standards, core values); lock or allow-adapt each; see cross-franchisee oversight/rollups; manage membership; set the group billing model |
| **Franchisor Viewer** (new, optional) | The whole group, read-only | See rollups & compliance, no editing |
| **Franchisee Owner** (existing `super_admin`) | Their **own** org only | Everything they can do today — invite/manage their **managers and staff**, run their **locations**, manage **their own card & billing**, and adapt any content the franchisor left unlocked. **Unchanged.** |
| **Manager / Shift lead / Staff** (existing) | Their org / location | Unchanged — scoped to their franchisee, never see other franchisees |

**Key answer:** the franchisee owner who adds their own credit card still gets a
**full top-level owner admin** over their own account (team, staff, locations,
billing) — just like a standalone owner. The franchisor's admin is a *broader*
one over the whole group, not a replacement for the franchisee's.

---

## 3. Data model

New tables (additive — no destructive changes):

```
franchise_groups
  id            uuid pk
  name          text
  owner_user_id uuid           -- the franchisor admin
  billing_mode  text           -- 'central' | 'distributed' | 'hybrid'
  created_at    timestamptz

franchise_memberships
  group_id      uuid  -> franchise_groups
  org_id        uuid  -> organizations   (one org = one franchisee)
  status        text  -- 'invited' | 'active' | 'removed'
  joined_at     timestamptz
  primary key (group_id, org_id)

franchise_admins            -- who can act at the group level
  group_id      uuid
  user_id       uuid
  role          text  -- 'admin' | 'viewer'
  primary key (group_id, user_id)

-- organizations gains a nullable pointer for fast lookups + a lock flag source
organizations.franchise_group_id  uuid null
```

Brand content distribution (Phase 2) reuses existing content tables (tests,
hiring criteria, journey standards, core values, department standards) plus a
small mapping so a franchisee's copy remembers its brand source and lock state:

```
brand_content_links
  group_id        uuid
  content_type    text   -- 'test' | 'hiring' | 'journey' | 'value' | 'standard'
  source_id       uuid   -- the franchisor's canonical item
  org_id          uuid   -- the franchisee it was pushed to
  local_id        uuid   -- the franchisee's copy
  locked          boolean         -- true = franchisee can't edit brand content
  last_pushed_at  timestamptz
```

---

## 4. Access & security (RLS)

The two hard requirements:

1. **Franchisee ↔ franchisee isolation stays absolute.** Franchisee A never sees
   B's guests, staff, or data. This is already how per-org RLS works today; the
   franchise layer must not weaken it.
2. **Franchisor read access is additive and scoped.** A new helper
   `is_franchisor_of(org_id)` returns true when the current user is an admin of a
   group that org belongs to. Franchisor rollup queries use it to read
   **compliance/aggregate** fields across member orgs.

Privacy choice to settle up front: how much raw data the franchisor sees.
Recommended default — **franchisor sees compliance + aggregates** (training
completion %, spot-check cadence, audit health, repeat-rate trend), **not raw
guest PII**. Make guest-level visibility an explicit, per-group toggle if a brand
wants it, so it's a deliberate decision, never a default leak.

Secrets stay per-org and deny-all as today (billing tokens etc.); the franchisor
never sees a franchisee's card token — only whether they're paid/past-due.

---

## 5. Governance — push down & lock (the "everyone follows the same X")

The franchisor authors a **Brand Library** at the group level: training programs
& tests, hiring criteria, guest-journey standards, core values, department
standards. For each item they choose:

- **Locked (brand standard)** — pushed to every franchisee; the franchisee can
  *use* it but not edit it. Updates re-push automatically.
- **Adaptable (starting point)** — pushed as a starting copy the franchisee can
  localize (local menu, local flavor) on top of the brand baseline.

Mechanics: pushing clones the canonical item into each member org (so it lives in
the franchisee's normal training/hiring flows) and records a `brand_content_link`
with the lock flag. A "Publish update" re-syncs locked items. Franchisees see a
small **"Brand standard"** badge on locked content so it's clear what's theirs to
change vs. what's set by the franchisor — the same pattern as our existing
"Sample — make it yours" ribbons, inverted.

---

## 6. Oversight — the franchisor console

A franchisor-only area (like the platform-admin area, but scoped to their group)
showing, per franchisee and brand-wide:

- **Compliance:** training completion %, who's overdue, spot-check cadence,
  daily-checklist compliance, audit health score.
- **Outcomes:** repeat rate & retention-program ROI trend, culture-moment cadence.
- **Roll-up + hit list:** brand-wide averages plus the franchisees slipping —
  exactly the leadership-rollup pattern already built for Partners, one level up.

Read-only into each franchisee's numbers; the franchisor coaches, the franchisee
runs the floor.

---

## 7. Billing — all three models (answers the original question)

Because each org already has its own billing + card-on-file (the Global Payments
work we shipped), the group can bill any of these ways:

1. **Central — franchisor pays for all.** The group holds one payment method;
   every member org's monthly charge rolls into one invoice to the franchisor.
2. **Distributed — each franchisee pays their own** *(the model in question)*.
   Each franchisee keeps their **own card on file** and pays their own account,
   while remaining governed by and visible to the franchisor. The franchisor
   "hosts" (standards + oversight) **without paying**. The franchisee owner keeps
   full billing control of their own account.
3. **Hybrid.** Franchisor covers a base (or negotiates a group rate everyone
   inherits — grandfathered per our pricing lock), franchisee covers add-ons or
   extra locations.

`franchise_groups.billing_mode` drives which path each charge/invoice takes; the
per-org billing engine we built already handles the "each franchisee pays their
own" case with zero changes to the charge logic.

---

## 8. Onboarding a franchisee into a group

- Franchisor sends a **join link / group code** (like a team invite, one level
  up). The franchisee signs up (or links an existing org), lands in the group,
  and immediately inherits the brand-locked content.
- If distributed billing: the franchisee is prompted to add their own card
  (existing Settings → Billing flow).
- If central: no card prompt; the group covers them.

---

## 9. Phased build plan (each phase shippable)

**Phase 1 — Group + membership + oversight (read-only).**
Group/membership/admin tables, `is_franchisor_of()` RLS helper, franchisor
console with the compliance rollup + hit list. No content push, no billing
changes yet. Immediately demoable to a franchisor: "here's every store's
compliance in one view."

**Phase 2 — Governance (push down & lock).**
Brand Library, push-to-members with lock/adapt, `brand_content_link` tracking,
"Brand standard" badges, "Publish update" re-sync. This is the "everyone follows
the same training/hiring/standards" pillar.

**Phase 3 — Flexible group billing.**
`billing_mode` (central / distributed / hybrid), group invoice rollup for
central, group-rate inheritance for hybrid. Distributed already works via the
existing per-org billing.

---

## 10. Decisions to lock before building

1. **Lock granularity** — which content types are lockable, and is lock
   per-item or per-type? (Recommended: per-item, franchisor's choice.)
2. **Franchisor data visibility** — compliance/aggregates only (recommended
   default) vs. optional raw guest access per group.
3. **Billing owner per model** — confirm who the payment customer is in central
   vs. distributed, and how receipts/invoices should read for each.
4. **Franchisee autonomy limits** — beyond locked content, can a franchisee
   change their own values/journey, or must those mirror the brand too?

---

## Why Wingman is well-positioned

We already have the hard parts: multi-location + role/RLS access control,
AI-generated training/hiring, per-org grandfathered billing with card-on-file,
and the leadership rollup pattern (Partners). The franchise tier mostly
**generalizes "one org → many locations + rollup" up a level** to "one group →
many orgs + rollup + content push-down." It's a meaningful build, but a natural
extension of what's here — not a rewrite.
