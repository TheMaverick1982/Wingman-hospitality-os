import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXAMPLE_TESTS } from "@/lib/tests";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./constants";

/** How long a per-visitor "Try the demo" sandbox lives before the reaper deletes it. */
export const SANDBOX_TTL_HOURS = 3;

// ---------------------------------------------------------------------------
// Demo reseed engine.
//
// One shared org sits behind the wingmandemo@gmail.com login. On every sign-in
// (see src/app/login/actions.ts) reseedDemoOrg() runs: it guarantees the auth
// user, org, locations and profile exist, wipes all tenant content for that
// org, then repopulates it with the curated showcase below so the whole app —
// dashboard, culture, guests, staff, growth, audits, menu, health — looks
// alive. Everything here runs through the service-role admin client, so it
// bypasses RLS and the auth.uid()-gated guard triggers.
// ---------------------------------------------------------------------------

type Dept = "Host" | "Server" | "Bartender" | "Chef" | "Manager";

const ORG_NAME = "Lantern & Vine";
const LOCATIONS = [
  { name: "Lantern & Vine — Downtown", address: "128 Marlow St, Austin, TX 78701", phone: "(512) 555-0142", email: "downtown@lanternvine.com" },
  { name: "Lantern & Vine — Riverside", address: "44 Harbor Walk, Austin, TX 78703", phone: "(512) 555-0198", email: "riverside@lanternvine.com" },
];

// ---- date helpers (relative to now so the demo always reads as current) -----
function isoDay(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
function isoTs(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}
/** Most recent Monday, minus `weeksAgo` weeks, as YYYY-MM-DD. */
function weekStart(weeksAgo: number): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const backToMon = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - backToMon - weeksAgo * 7);
  return d.toISOString().slice(0, 10);
}

export type DemoContext = {
  userId: string;
  orgId: string;
  locationIds: string[]; // [downtown, riverside]
};

// ---------------------------------------------------------------------------
// Bootstrap: auth user
// ---------------------------------------------------------------------------

async function findUserIdByEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Ensures the wingmandemo auth user exists (created with the known demo
 * password on first run). Idempotent.
 *
 * IMPORTANT: for an existing user we do NOT touch the password by default.
 * Resetting a user's password revokes their active sessions in GoTrue — and
 * since reseed runs *after* signInWithPassword, resetting here would silently
 * log the demo viewer straight back out to the homepage. Pass
 * `{ resetPassword: true }` only from an out-of-band path (the ops route),
 * never during login.
 */
export async function ensureDemoUser(opts?: { resetPassword?: boolean }): Promise<string> {
  const admin = createAdminClient();
  const existingId = await findUserIdByEmail(admin, DEMO_EMAIL);
  if (existingId) {
    if (opts?.resetPassword) {
      await admin.auth.admin.updateUserById(existingId, { password: DEMO_PASSWORD, email_confirm: true });
    }
    return existingId;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Demo Operator" },
  });
  if (error || !data.user) throw error ?? new Error("Failed to create demo user");
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Bootstrap: org + locations + profile
// ---------------------------------------------------------------------------

async function ensureDemoOrg(userId: string): Promise<DemoContext> {
  const admin = createAdminClient();

  // Prefer the profile the demo user already owns; fall back to the flagged org.
  let orgId: string | null = null;
  const { data: profile } = await admin.from("profiles").select("org_id").eq("id", userId).maybeSingle();
  if (profile?.org_id) orgId = profile.org_id as string;
  if (!orgId) {
    // The shared master is the one durable demo org (ephemeral sandboxes carry a
    // demo_expires_at), so filter those out to avoid a multiple-row match.
    const { data: demoOrg } = await admin
      .from("organizations")
      .select("id")
      .eq("is_demo", true)
      .is("demo_expires_at", null)
      .maybeSingle();
    if (demoOrg?.id) orgId = demoOrg.id as string;
  }

  if (!orgId) {
    const { data: org, error } = await admin
      .from("organizations")
      .insert({ name: ORG_NAME, is_demo: true })
      .select("id")
      .single();
    if (error || !org) throw error ?? new Error("Failed to create demo org");
    orgId = org.id as string;
  } else {
    await admin.from("organizations").update({ is_demo: true }).eq("id", orgId);
  }

  // Ensure exactly our two locations exist (stable ids across reseeds).
  const { data: existingLocs } = await admin
    .from("locations")
    .select("id, name")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  const locs = existingLocs ?? [];
  const locationIds: string[] = [];
  for (let i = 0; i < LOCATIONS.length; i++) {
    const want = LOCATIONS[i];
    const found = locs[i];
    if (found) {
      await admin.from("locations").update(want).eq("id", found.id);
      locationIds.push(found.id as string);
    } else {
      const { data: loc, error } = await admin
        .from("locations")
        .insert({ org_id: orgId, ...want })
        .select("id")
        .single();
      if (error || !loc) throw error ?? new Error("Failed to create demo location");
      locationIds.push(loc.id as string);
    }
  }
  // Drop any extra locations beyond our canonical two.
  for (let i = LOCATIONS.length; i < locs.length; i++) {
    await admin.from("locations").delete().eq("id", locs[i].id);
  }

  // Ensure the demo user's profile (super admin, all locations).
  const { data: prof } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!prof) {
    const { error } = await admin.from("profiles").insert({
      id: userId,
      org_id: orgId,
      full_name: "Demo Operator",
      access_role: "super_admin",
      location_id: null,
      all_locations: true,
    });
    if (error) throw error;
  } else {
    await admin.from("profiles").update({ org_id: orgId, full_name: "Demo Operator", access_role: "super_admin", all_locations: true }).eq("id", userId);
  }

  return { userId, orgId, locationIds };
}

// ---------------------------------------------------------------------------
// Wipe: clear all tenant content for the demo org (keep org/locations/profile).
// ---------------------------------------------------------------------------

const WIPE_TABLES = [
  // children first where a restrict FK could exist; most are cascade/set-null,
  // but explicit ordering keeps this safe regardless.
  "test_assignments",
  "test_questions",
  "test_days",
  "tests",
  "guest_visits",
  "guests",
  "staff_training_progress",
  "training_signoffs",
  "staff_members",
  "candidates",
  "culture_moments",
  "menu_items",
  "menu_engineering_items",
  "menu_references",
  "department_standards",
  "department_training_items",
  "department_meta",
  "hiring_traits",
  "core_values",
  "discounts",
  "spot_checks",
  "daily_checklists",
  "coaching_logs",
  "pre_shift_checks",
  "ambiance_checks",
  "shift_checklist_completions",
  "accountability_checklist_items",
  "audits",
  "business_health_metrics",
  "growth_plan_entries",
  "growth_plans",
  "playbook_articles",
  "report_schedules",
  // Partners (B2B / Community) — children first.
  "partner_metrics_snapshots",
  "partner_activities",
  "partner_goals",
  "partner_contacts",
  "audit_events",
  "square_connections",
  "clover_connections",
  "billing_charges",
  "billing_payment_methods",
] as const;

// SAFETY GUARD. This mass-delete is destructive — it wipes every tenant table for
// an org. It must NEVER touch a real customer's org. We re-read is_demo straight
// from the database immediately before deleting, and refuse to proceed unless the
// org is explicitly flagged as a demo. So even if a future change accidentally
// pointed the reseed at a real org, no customer data can be deleted.
async function assertIsDemoOrg(orgId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").select("is_demo").eq("id", orgId).maybeSingle();
  if (error) throw new Error(`Reseed aborted: couldn't verify org ${orgId} before wipe: ${error.message}`);
  if (!data || (data as { is_demo: boolean }).is_demo !== true) {
    throw new Error(`Reseed aborted: org ${orgId} is not a demo org — refusing to delete tenant data.`);
  }
}

async function wipeDemoOrg(orgId: string): Promise<void> {
  const admin = createAdminClient();
  await assertIsDemoOrg(orgId); // never wipe a non-demo org
  for (const table of WIPE_TABLES) {
    const { error } = await admin.from(table).delete().eq("org_id", orgId);
    if (error) throw new Error(`Wipe failed on ${table}: ${error.message}`);
  }
}

// Owner-uploaded / owner-customized org assets that a reseed must never drop.
// These are things the operator set for themselves (a logo, a customized apply
// form, notification choices), not part of the seeded showcase — so we snapshot
// them before the wipe and restore them after repopulating.
const PRESERVED_ORG_FIELDS = [
  "logo_url",
  "public_slug",
  "apply_enabled",
  "applications_cc",
  "application_form_config",
  "notification_settings",
] as const;

async function snapshotOwnerAssets(orgId: string): Promise<Record<string, unknown> | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("organizations").select(PRESERVED_ORG_FIELDS.join(", ")).eq("id", orgId).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

async function restoreOwnerAssets(orgId: string, snapshot: Record<string, unknown> | null): Promise<void> {
  if (!snapshot) return;
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  for (const key of PRESERVED_ORG_FIELDS) {
    // Only restore a value that was actually set, so a brand-new demo org keeps
    // its defaults rather than being forced to null/empty.
    if (snapshot[key] !== undefined && snapshot[key] !== null) patch[key] = snapshot[key];
  }
  if (Object.keys(patch).length === 0) return;
  await admin.from("organizations").update(patch).eq("id", orgId);
}

// ---------------------------------------------------------------------------
// Seed content
// ---------------------------------------------------------------------------

const CORE_VALUES = [
  ["We create reactions, not transactions", "Guests don't return because of what they bought. They return because of how they felt.", "Tell me about a time you made a customer feel genuinely special.", "Describes reading the person and adjusting in the moment.", "Describes following a script or company policy."],
  ["Recognition drives loyalty", "A returning guest should never feel like a new guest.", "How would you make a repeat customer feel different from a first-timer?", "Specific ideas: names, preferences, small callbacks.", "Treats every customer identically, no mention of familiarity."],
  ["Personalization over standardization", "Read the guest. Adjust tone and pacing. Never sound scripted.", "How would you handle two very different guests back to back?", "Naturally shifts tone and pacing between the two.", "Gives the same approach for both examples."],
  ["Every role owns the experience", "Hospitality isn't one position's job. Host, server, bartender, chef, manager — all in.", "Tell me about a time something wasn't your job, but you helped anyway.", "Jumps in without being asked, no \"not my role\" framing.", "Waits to be told, or frames helping as an inconvenience."],
  ["The details define the brand", "Speed of greeting, cleanliness, timing, eye contact. Small things, big impression.", "What did you notice the last time you got great service somewhere?", "Specific small details — timing, greeting, cleanliness.", "Vague answer (\"it was nice\"), nothing concrete."],
];

const STANDARDS: [Dept, string][] = [
  ["Host", "Greet every guest immediately — smile, eye contact, drop what you're doing"],
  ["Host", "Ask: \"Is this your first time with us?\""],
  ["Host", "Read the guest and seat accordingly"],
  ["Host", "Notify the MOD immediately of any first-time guest"],
  ["Host", "Introduce the server by name"],
  ["Host", "Offer loyalty sign-up on every to-go order"],
  ["Server", "Build rapport — use names, notice celebrations"],
  ["Server", "One specific recommendation per course, every course"],
  ["Server", "Mention loyalty early — name, points, offers"],
  ["Server", "Ask: \"Is this your first time dining with us?\""],
  ["Server", "Fast first drinks, constant table scanning"],
  ["Server", "Thank by name and invite back with something specific"],
  ["Bartender", "Greet by name whenever possible"],
  ["Bartender", "Ask a follow-up question from their last visit"],
  ["Bartender", "First drink out fast — every time"],
  ["Bartender", "Encourage second and third rounds naturally"],
  ["Bartender", "Keep the bar top clean at all times"],
  ["Chef", "Walk the dining room once per hour"],
  ["Chef", "Inspect food quality with your eyes, not from the pass"],
  ["Chef", "Introduce yourself at a table at least once per shift"],
  ["Chef", "Take ownership of any issue — fix it immediately"],
  ["Manager", "On the floor during every peak period"],
  ["Manager", "Engage every table possible, approach first-time guests"],
  ["Manager", "Thank every departing guest personally"],
  ["Manager", "Coach in real time — correction and praise"],
  ["Manager", "Log and follow through on every bounce-back interaction"],
];

const DEPARTMENT_META: [Dept, string, boolean][] = [
  ["Host", "Seating & flow", false],
  ["Server", "Menu & product knowledge", true],
  ["Bartender", "Bar & beverage knowledge", true],
  ["Chef", "Kitchen standards & safety", true],
  ["Manager", "Operations & leadership", false],
];

const TRAINING: [Dept, string][] = [
  ["Host", "Know the floor plan and rotation order cold"],
  ["Host", "Know how the reservation / waitlist system works"],
  ["Host", "Know today's realistic wait time before a guest asks"],
  ["Host", "Know how to page a manager fast without leaving the door unattended"],
  ["Server", "Know every dish's key ingredients and prep style"],
  ["Server", "Know common allergens for every menu item"],
  ["Server", "Know today's specials before the first table sits"],
  ["Server", "Can describe any dish in one confident sentence, no notes"],
  ["Server", "Know how to enter modifiers and allergies correctly in the POS"],
  ["Server", "Suggest a specific pairing — a wine, side, or sauce — with every entrée recommendation"],
  ["Server", "Have one ready-to-go upsell pairing for each of the top-selling dishes"],
  ["Bartender", "Know every cocktail recipe and pour standard exactly"],
  ["Bartender", "Know the beer and wine list by style, not just name"],
  ["Bartender", "Check ID every time policy requires it, no exceptions"],
  ["Bartender", "Know how to 86 an item and communicate it to the floor fast"],
  ["Chef", "Know safe holding temperatures cold and hot — never guess"],
  ["Chef", "Treat food safety as non-negotiable, not a busy-night shortcut"],
  ["Chef", "Know allergen protocol and cross-contact prevention by station"],
  ["Chef", "Know the plating standard for every dish on the line"],
  ["Chef", "Know par levels and the prep list without being told"],
  ["Manager", "Know daily KPI targets: sales, labor %, discount %"],
  ["Manager", "Can run a pre-shift meeting in under 5 minutes"],
  ["Manager", "Know scheduling and labor cost basics for the shift"],
  ["Manager", "Know exactly when a discount needs owner-level approval"],
];

const HIRING_TRAITS: [Dept, string, string, string, string][] = [
  ["Host", "Composure under a full waitlist", "Tell me about a time you had an angry line of people waiting and no tables ready. What did you do?", "Stayed calm, communicated proactively, prioritized fairly.", "Got flustered, avoided guests, or blamed the kitchen/servers."],
  ["Host", "Spatial and organizational awareness", "How would you decide where to seat a big walk-in group during a rush?", "Thinks about flow, server sections, and guest comfort at once.", "Would seat randomly with no awareness of server load."],
  ["Server", "Sales confidence", "Sell me a menu item you've never sold before, right now.", "Confident, specific, enthusiastic without being pushy.", "Hesitant, generic, or refuses to try."],
  ["Server", "Resilience with a difficult table", "Tell me about the worst table you've ever had. What happened?", "Takes ownership, stays composed, focuses on resolution.", "Blames the guest, gets defensive, no resolution offered."],
  ["Bartender", "Multitasking under volume", "Describe handling a slammed bar with tickets piling up.", "Prioritizes, stays calm, communicates with the team.", "Freezes, lets quality slip, or snaps at coworkers."],
  ["Bartender", "Memory and rapport", "How do you remember regulars' usual orders?", "Has a real system or habit and clearly cares about it.", "Doesn't try, or says it doesn't really matter."],
  ["Chef", "Consistency obsession", "Tell me about a time you sent back your own team's dish.", "Holds a high bar even under pressure, cites a real standard.", "Lets things slide to save time, no standard mentioned."],
  ["Chef", "Coachability under pressure", "Tell me about the last time a chef corrected you mid-service.", "Took it well, adjusted immediately, no ego about it.", "Got defensive, argued, or repeated the same mistake."],
  ["Manager", "Leadership presence", "Tell me about a time you had to correct a staff member mid-shift.", "Direct but respectful, focused on the standard, not the person.", "Avoided it, did it harshly in public, or let it slide."],
  ["Manager", "Decision-making under conflict", "A guest and a server disagree about what was ordered. What do you do?", "Investigates fairly, protects the guest experience without throwing staff under the bus.", "Automatically sides with one party, no real investigation."],
];

const MENU_ITEMS: {
  department: Dept; name: string; description: string; price: number; allergens: string;
  pairing: string; upsell: string; popularity: number; profit: number;
}[] = [
  { department: "Server", name: "Charred Hearth Bread", description: "Wood-oven sourdough, cultured butter, smoked sea salt.", price: 9, allergens: "Gluten, Dairy", pairing: "Glass of Grüner Veltliner", upsell: "Add whipped 'nduja butter (+$4)", popularity: 74, profit: 6.5 },
  { department: "Server", name: "Little Gem Caesar", description: "Little gems, white anchovy, aged parmesan, rye crumb.", price: 15, allergens: "Fish, Dairy, Gluten", pairing: "Sauvignon Blanc", upsell: "Add grilled chicken (+$8) or shrimp (+$11)", popularity: 61, profit: 10 },
  { department: "Server", name: "Cast-Iron Half Chicken", description: "Brick-pressed, lemon-thyme jus, confit potato.", price: 29, allergens: "—", pairing: "Pinot Noir", upsell: "Add charred broccolini (+$9)", popularity: 82, profit: 19 },
  { department: "Server", name: "Coal-Roasted Beet Salad", description: "Golden & red beets, whipped chèvre, hazelnut, citrus.", price: 16, allergens: "Dairy, Tree Nuts", pairing: "Dry rosé", upsell: "Add burrata (+$6)", popularity: 44, profit: 11.5 },
  { department: "Server", name: "Bavette Steak Frites", description: "Grilled bavette, bordelaise, hand-cut fries.", price: 34, allergens: "—", pairing: "Malbec", upsell: "Add peppercorn or bone-marrow butter (+$4)", popularity: 78, profit: 21 },
  { department: "Server", name: "Vanilla Bean Pot de Crème", description: "Dark chocolate shell, sea salt, olive oil.", price: 12, allergens: "Dairy, Egg", pairing: "Tawny Port", upsell: "Affogato style with espresso (+$3)", popularity: 57, profit: 9 },
  { department: "Bartender", name: "Lantern Old Fashioned", description: "Toasted-pecan bourbon, demerara, black walnut bitters.", price: 16, allergens: "—", pairing: "Bavette Steak Frites", upsell: "Rare-barrel pour (+$8)", popularity: 88, profit: 12.5 },
  { department: "Bartender", name: "Riverside Spritz", description: "Aperitivo, cava, grapefruit oil, rosemary.", price: 14, allergens: "—", pairing: "Beet Salad", upsell: "Make it a carafe for the table (+$26)", popularity: 69, profit: 10.5 },
  { department: "Bartender", name: "Garden Gimlet", description: "Cucumber gin, lime cordial, basil.", price: 15, allergens: "—", pairing: "Little Gem Caesar", upsell: "Zero-proof version available", popularity: 52, profit: 11 },
  { department: "Chef", name: "Tasting of the Hearth", description: "Chef's five-course seasonal tasting.", price: 95, allergens: "Varies — ask server", pairing: "Wine pairing (+$55)", upsell: "Add the wine pairing (+$55)", popularity: 31, profit: 52 },
];

const CULTURE_MOMENTS: [string, string, "Ownership" | "Guest Connection" | "Teamwork" | "Went Above", string, number][] = [
  ["Maya R.", "Devon P.", "Guest Connection", "Remembered the Hollisters' anniversary from three months ago and sent out a plated dessert with a candle. They booked their next two visits on the spot.", 2],
  ["Chef Andre", "The whole line", "Teamwork", "Slammed Saturday, two people called out, and the line never fell behind. Every ticket out under time. Proud of this crew.", 4],
  ["Nadia K.", "Sam T.", "Went Above", "A guest spilled red wine on a birthday dress. Sam quietly grabbed club soda, comped a glass, and had a card signed by the table's server. She left laughing.", 6],
  ["Devon P.", "Maya R.", "Ownership", "Caught a wrong allergen ticket before it left the pass — no drama, just fixed it and re-fired. That's the standard.", 3],
  ["Sam T.", "Priya N.", "Guest Connection", "New four-top, clearly first-timers. Priya walked them through the menu like old friends. They signed up for loyalty before entrees.", 8],
  ["Priya N.", "Chef Andre", "Went Above", "Regular mentioned a shellfish allergy mid-service; Chef came out personally to walk her through safe options. She said she's never felt safer eating out.", 5],
  ["Marcus L.", "Nadia K.", "Teamwork", "Jumped on the host stand during a rush without being asked so the door never went unattended. Seamless.", 1],
  ["Chef Andre", "Elena V.", "Ownership", "Owned a mis-fire on her table, re-fired herself, and still turned the section on time. No excuses.", 7],
  ["Maya R.", "Marcus L.", "Guest Connection", "Greeted a returning couple by name and had their usual bar seats ready. Small thing, huge reaction.", 10],
  ["Devon P.", "The Riverside team", "Teamwork", "First Friday over $14k. Everyone stayed to reset the floor together. This is what ownership looks like.", 2],
];

const GUESTS: { name: string; phone: string; email: string; referred: boolean; visits: { n: number; days: number; loc: number; incentive: string; notes: string; reaction: "wowed" | "delighted" | "neutral" | "let_down" }[] }[] = [
  { name: "The Hollisters", phone: "(512) 555-0110", email: "hollister@example.com", referred: true, visits: [
    { n: 1, days: 96, loc: 0, incentive: "First-visit dessert", notes: "Anniversary — server noted the date.", reaction: "delighted" },
    { n: 2, days: 54, loc: 0, incentive: "Reserved usual booth", notes: "Asked for Maya again.", reaction: "wowed" },
    { n: 3, days: 12, loc: 0, incentive: "Comped celebration dessert", notes: "Booked next two visits.", reaction: "wowed" },
  ]},
  { name: "James Okafor", phone: "(512) 555-0121", email: "j.okafor@example.com", referred: false, visits: [
    { n: 1, days: 40, loc: 1, incentive: "Welcome cocktail", notes: "First-timer, sat at the bar.", reaction: "delighted" },
    { n: 2, days: 9, loc: 1, incentive: "Bartender remembered his order", notes: "Garden Gimlet regular now.", reaction: "wowed" },
  ]},
  { name: "Priya & Sanjay", phone: "(512) 555-0132", email: "psanjay@example.com", referred: true, visits: [
    { n: 1, days: 70, loc: 0, incentive: "First-visit bread service", notes: "Shellfish allergy noted.", reaction: "delighted" },
    { n: 2, days: 33, loc: 0, incentive: "Chef greeted table", notes: "Felt safe with allergy handling.", reaction: "wowed" },
    { n: 3, days: 5, loc: 1, incentive: "Cross-location welcome", notes: "Tried the Riverside patio.", reaction: "delighted" },
  ]},
  { name: "Dana Whitfield", phone: "(512) 555-0143", email: "dana.w@example.com", referred: false, visits: [
    { n: 1, days: 22, loc: 1, incentive: "Loyalty sign-up", notes: "Solo diner at the bar.", reaction: "neutral" },
  ]},
  { name: "The Nguyen Family", phone: "(512) 555-0154", email: "nguyen@example.com", referred: true, visits: [
    { n: 1, days: 60, loc: 0, incentive: "Kids' welcome cookie", notes: "Party of 5, birthday.", reaction: "delighted" },
    { n: 2, days: 27, loc: 0, incentive: "Birthday dessert", notes: "Requested same server.", reaction: "wowed" },
  ]},
  { name: "Carla Mendes", phone: "(512) 555-0165", email: "carla.m@example.com", referred: false, visits: [
    { n: 1, days: 48, loc: 1, incentive: "First-visit spritz", notes: "Slow greet — flagged in spot check.", reaction: "let_down" },
    { n: 2, days: 14, loc: 1, incentive: "Manager follow-up call", notes: "Recovered — manager reached out.", reaction: "delighted" },
  ]},
  { name: "Theo Bright", phone: "(512) 555-0176", email: "theo.b@example.com", referred: false, visits: [
    { n: 1, days: 8, loc: 0, incentive: "Loyalty sign-up", notes: "First time, tasting menu.", reaction: "wowed" },
  ]},
  { name: "The Alvarados", phone: "(512) 555-0187", email: "alvarado@example.com", referred: true, visits: [
    { n: 1, days: 88, loc: 1, incentive: "First-visit dessert", notes: "Referred by the Hollisters.", reaction: "delighted" },
    { n: 2, days: 44, loc: 1, incentive: "Usual patio table", notes: "", reaction: "delighted" },
    { n: 3, days: 19, loc: 0, incentive: "Tried downtown", notes: "", reaction: "wowed" },
    { n: 4, days: 3, loc: 0, incentive: "VIP bar seats", notes: "Now every-other-week regulars.", reaction: "wowed" },
  ]},
  { name: "Grace Liu", phone: "(512) 555-0198", email: "grace.liu@example.com", referred: false, visits: [
    { n: 1, days: 31, loc: 0, incentive: "Welcome bread", notes: "", reaction: "neutral" },
  ]},
  { name: "Marcus Webb", phone: "(512) 555-0209", email: "m.webb@example.com", referred: false, visits: [
    { n: 1, days: 17, loc: 1, incentive: "First-visit cocktail", notes: "Business dinner.", reaction: "delighted" },
    { n: 2, days: 2, loc: 1, incentive: "Remembered his wine", notes: "", reaction: "wowed" },
  ]},
];

const STAFF: { name: string; department: Dept; loc: number; email: string; phone: string; status: "active" | "inactive"; hiredDays: number }[] = [
  { name: "Maya Rivera", department: "Server", loc: 0, email: "maya@lanternvine.com", phone: "(512) 555-0301", status: "active", hiredDays: 420 },
  { name: "Devon Park", department: "Server", loc: 0, email: "devon@lanternvine.com", phone: "(512) 555-0302", status: "active", hiredDays: 300 },
  { name: "Sam Turner", department: "Bartender", loc: 0, email: "sam@lanternvine.com", phone: "(512) 555-0303", status: "active", hiredDays: 260 },
  { name: "Priya Nair", department: "Host", loc: 0, email: "priya@lanternvine.com", phone: "(512) 555-0304", status: "active", hiredDays: 190 },
  { name: "Andre Costa", department: "Chef", loc: 0, email: "andre@lanternvine.com", phone: "(512) 555-0305", status: "active", hiredDays: 640 },
  { name: "Elena Vasquez", department: "Server", loc: 0, email: "elena@lanternvine.com", phone: "(512) 555-0306", status: "active", hiredDays: 75 },
  { name: "Marcus Lee", department: "Manager", loc: 0, email: "marcusl@lanternvine.com", phone: "(512) 555-0307", status: "active", hiredDays: 520 },
  { name: "Nadia Khan", department: "Server", loc: 1, email: "nadia@lanternvine.com", phone: "(512) 555-0311", status: "active", hiredDays: 210 },
  { name: "Tomás Reyes", department: "Bartender", loc: 1, email: "tomas@lanternvine.com", phone: "(512) 555-0312", status: "active", hiredDays: 150 },
  { name: "Hannah Cole", department: "Host", loc: 1, email: "hannah@lanternvine.com", phone: "(512) 555-0313", status: "active", hiredDays: 95 },
  { name: "Ben Adler", department: "Chef", loc: 1, email: "ben@lanternvine.com", phone: "(512) 555-0314", status: "active", hiredDays: 330 },
  { name: "Sofia Marin", department: "Server", loc: 1, email: "sofia@lanternvine.com", phone: "(512) 555-0315", status: "active", hiredDays: 48 },
  { name: "Ryan Foster", department: "Manager", loc: 1, email: "ryanf@lanternvine.com", phone: "(512) 555-0316", status: "active", hiredDays: 400 },
  { name: "Chris Doyle", department: "Server", loc: 0, email: "chris@lanternvine.com", phone: "(512) 555-0308", status: "inactive", hiredDays: 240 },
];

const PLAYBOOK: [string, string][] = [
  ["The Lantern & Vine Greeting", "Every guest is greeted within 10 seconds of walking in — eye contact, a real smile, and \"Is this your first time with us?\" First-timers get flagged to the MOD immediately so we can make the visit memorable."],
  ["Bounce-Back Protocol", "The goal of visit one is visit two. Every first-time guest leaves with a reason to come back: a loyalty sign-up, a specific invitation (\"our patio is beautiful on Sundays\"), or a small incentive. Log every bounce-back interaction so nothing falls through."],
  ["Handling Allergies", "Allergies are never a 'the kitchen will figure it out' situation. Enter them in the POS exactly, tell the expo verbally, and for serious allergies the chef greets the table personally. Cross-contact prevention is by station."],
  ["Recovering a Bad Experience", "When something goes wrong: acknowledge fast, own it (never blame another department in front of the guest), fix it, and follow up. A recovered guest is often more loyal than one who never had a problem. Manager makes the call on comps."],
  ["Pre-Shift Meeting Standard", "Under five minutes, every shift: today's specials, one culture focus, VIPs / large parties on the books, and one thing we're working on. End with energy, not a checklist read-off."],
  ["Closing the Floor Together", "We reset the floor as a team. Nobody leaves a full section for someone else to close. Last table gets the same energy as the first — thank them by name and invite them back with something specific."],
];

// ---------------------------------------------------------------------------
// Populate
// ---------------------------------------------------------------------------

async function populateDemoOrg(ctx: DemoContext): Promise<void> {
  const admin = createAdminClient();
  const { orgId, userId, locationIds } = ctx;
  const [downtown, riverside] = locationIds;

  // Organization profile.
  await admin.from("organizations").update({
    name: ORG_NAME,
    philosophy: "We are not in the restaurant business. We are in the business of creating guest experiences that drive emotional connection, repeat visits, and long-term loyalty.",
    weekly_focus: "One specific recommendation per course — every course, every table.",
    x_factor: "The wood-fired hearth in the center of every dining room — food finished in front of the guest.",
    weekly_experiment: "Bartenders offer a zero-proof pairing on every cocktail recommendation and log the take rate.",
    total_revenue: 4820000,
    system_generated: true,
    billing_status: "active",
    card_brand: "Visa",
    card_last4: "4242",
    current_period_end: isoTs(-20),
    is_demo: true,
  }).eq("id", orgId);

  // Culture / training / hiring foundations.
  await admin.from("core_values").insert(
    CORE_VALUES.map(([title, description, hq, hg, hr], i) => ({
      org_id: orgId, title, description, hiring_question: hq, hiring_green_flag: hg, hiring_red_flag: hr, sort_order: i,
    }))
  );

  const perDept: Record<string, number> = {};
  const { data: standardRows } = await admin.from("department_standards").insert(
    STANDARDS.map(([department, item]) => {
      perDept[department] = (perDept[department] ?? 0);
      return { org_id: orgId, department, item, sort_order: perDept[department]++, source: "wingman" };
    })
  ).select("id, department, item");

  await admin.from("department_meta").insert(
    DEPARTMENT_META.map(([department, track_label, has_menu]) => ({ org_id: orgId, department, track_label, has_menu }))
  );

  const perDeptT: Record<string, number> = {};
  const { data: trainingRows } = await admin.from("department_training_items").insert(
    TRAINING.map(([department, item]) => {
      perDeptT[department] = (perDeptT[department] ?? 0);
      return { org_id: orgId, department, item, sort_order: perDeptT[department]++, source: "wingman" };
    })
  ).select("id, department, item");

  await admin.from("hiring_traits").insert(
    HIRING_TRAITS.map(([department, title, question, green_flag, red_flag], i) => ({
      org_id: orgId, department, title, question, green_flag, red_flag, sort_order: i, source: "wingman",
    }))
  );

  // Menu (structured items + free-text references + engineering grid).
  await admin.from("menu_items").insert(
    MENU_ITEMS.map((m, i) => ({
      org_id: orgId, department: m.department, name: m.name, description: m.description,
      price: m.price, allergens: m.allergens, pairing_suggestion: m.pairing, upsell_suggestion: m.upsell,
      source: "wingman", popularity_pct: m.popularity, profit_amount: m.profit, sort_order: i,
    }))
  );
  await admin.from("menu_references").insert([
    { org_id: orgId, department: "Server", content: "Seasonal hearth-driven American menu. Signature: Cast-Iron Half Chicken, Bavette Steak Frites. Tasting menu available with wine pairing." },
    { org_id: orgId, department: "Bartender", content: "Barrel-aged and hearth-smoked cocktails. Signature: Lantern Old Fashioned. Full zero-proof program." },
    { org_id: orgId, department: "Chef", content: "Wood-fired hearth is the heart of the kitchen. Five-course tasting changes weekly with the market." },
  ]);
  await admin.from("menu_engineering_items").insert([
    { name: "Cast-Iron Half Chicken", price: 29, food_cost: 8.4, popularity: 3, sort_order: 0 },
    { name: "Bavette Steak Frites", price: 34, food_cost: 12.1, popularity: 3, sort_order: 1 },
    { name: "Little Gem Caesar", price: 15, food_cost: 3.8, popularity: 2, sort_order: 2 },
    { name: "Charred Hearth Bread", price: 9, food_cost: 1.7, popularity: 3, sort_order: 3 },
    { name: "Coal-Roasted Beet Salad", price: 16, food_cost: 4.2, popularity: 1, sort_order: 4 },
    { name: "Vanilla Bean Pot de Crème", price: 12, food_cost: 2.6, popularity: 2, sort_order: 5 },
    { name: "Tasting of the Hearth", price: 95, food_cost: 34, popularity: 1, sort_order: 6 },
    { name: "Lantern Old Fashioned", price: 16, food_cost: 3.5, popularity: 3, sort_order: 7 },
    { name: "Riverside Spritz", price: 14, food_cost: 3.2, popularity: 2, sort_order: 8 },
    { name: "Garden Gimlet", price: 15, food_cost: 3.9, popularity: 1, sort_order: 9 },
  ].map((m) => ({ org_id: orgId, created_by: userId, ...m })));

  // Guests + bounce-back visits.
  const { data: guestRows } = await admin.from("guests").insert(
    GUESTS.map((g) => ({ org_id: orgId, name: g.name, phone: g.phone, email: g.email, referred_a_friend: g.referred }))
  ).select("id, name");
  const guestIdByName = new Map((guestRows ?? []).map((r) => [r.name as string, r.id as string]));
  const visits: Record<string, unknown>[] = [];
  for (const g of GUESTS) {
    const gid = guestIdByName.get(g.name);
    if (!gid) continue;
    for (const v of g.visits) {
      visits.push({
        guest_id: gid, org_id: orgId, visit_number: v.n, visit_date: isoDay(v.days),
        location_id: locationIds[v.loc], incentive: v.incentive, notes: v.notes, reaction: v.reaction,
      });
    }
  }
  await admin.from("guest_visits").insert(visits);

  // Culture recognition wall.
  await admin.from("culture_moments").insert(
    CULTURE_MOMENTS.map(([author, about, tag, message, days]) => ({
      org_id: orgId, author, about, tag, message, created_by: userId, occurred_on: isoDay(days),
    }))
  );

  // Candidates (hiring pipeline) — a couple convert to staff.
  const { data: candidateRows } = await admin.from("candidates").insert([
    { org_id: orgId, location_id: downtown, name: "Elena Vasquez", department: "Server", occurred_on: isoDay(80), scores: [5, 4, 5, 4], recommendation: "Strong fit", notes: "Natural upseller, warm with guests.", created_by: userId },
    { org_id: orgId, location_id: riverside, name: "Sofia Marin", department: "Server", occurred_on: isoDay(52), scores: [4, 4, 5, 3], recommendation: "Fit", notes: "Great energy, needs POS training.", created_by: userId },
    { org_id: orgId, location_id: downtown, name: "Jordan Blake", department: "Bartender", occurred_on: isoDay(30), scores: [3, 3, 2, 3], recommendation: "Unsure", notes: "Solid technique, rapport unclear.", created_by: userId },
    { org_id: orgId, location_id: riverside, name: "Casey Wu", department: "Host", occurred_on: isoDay(18), scores: [5, 5, 4, 5], recommendation: "Strong fit", notes: "Composed under pressure, very organized.", created_by: userId },
    { org_id: orgId, location_id: downtown, name: "Pat Nolan", department: "Server", occurred_on: isoDay(11), scores: [2, 2, 3, 2], recommendation: "Not a fit", notes: "Scripted, no read on the guest.", created_by: userId },
  ]).select("id, name");
  const candidateIdByName = new Map((candidateRows ?? []).map((r) => [r.name as string, r.id as string]));

  // Staff roster.
  const { data: staffRows } = await admin.from("staff_members").insert(
    STAFF.map((s) => ({
      org_id: orgId, location_id: locationIds[s.loc], candidate_id: candidateIdByName.get(s.name) ?? null,
      full_name: s.name, department: s.department, email: s.email, phone: s.phone, status: s.status, hired_on: isoDay(s.hiredDays),
    }))
  ).select("id, full_name, department");
  const staffByName = new Map((staffRows ?? []).map((r) => [r.full_name as string, { id: r.id as string, department: r.department as Dept }]));

  // Training progress for a few staff against their department's items.
  const standardsByDept = new Map<string, { id: string }[]>();
  for (const r of standardRows ?? []) {
    const arr = standardsByDept.get(r.department as string) ?? [];
    arr.push({ id: r.id as string });
    standardsByDept.set(r.department as string, arr);
  }
  const trainingByDept = new Map<string, { id: string }[]>();
  for (const r of trainingRows ?? []) {
    const arr = trainingByDept.get(r.department as string) ?? [];
    arr.push({ id: r.id as string });
    trainingByDept.set(r.department as string, arr);
  }
  const progressRows: Record<string, unknown>[] = [];
  const progressFor = (name: string, standardPct: number, trainingPct: number, rating: string) => {
    const s = staffByName.get(name);
    if (!s) return;
    const std = standardsByDept.get(s.department) ?? [];
    const trn = trainingByDept.get(s.department) ?? [];
    std.forEach((item, i) => progressRows.push({
      org_id: orgId, staff_id: s.id, item_type: "standard", item_id: item.id,
      checked: i / std.length < standardPct, rating: i === 0 ? rating : "", note: "",
    }));
    trn.forEach((item, i) => progressRows.push({
      org_id: orgId, staff_id: s.id, item_type: "training", item_id: item.id,
      checked: i / trn.length < trainingPct, rating: "", note: "",
    }));
  };
  progressFor("Maya Rivera", 1.0, 1.0, "strong");
  progressFor("Devon Park", 0.9, 0.8, "strong");
  progressFor("Elena Vasquez", 0.5, 0.4, "coaching");
  progressFor("Nadia Khan", 0.85, 0.75, "strong");
  progressFor("Sofia Marin", 0.35, 0.25, "coaching");
  progressFor("Sam Turner", 1.0, 0.9, "strong");
  if (progressRows.length) await admin.from("staff_training_progress").insert(progressRows);

  // Training sign-offs.
  await admin.from("training_signoffs").insert([
    { org_id: orgId, staff_name: "Maya Rivera", department: "Server", completion_pct: 100, occurred_on: isoDay(35), created_by: userId, staff_id: staffByName.get("Maya Rivera")?.id ?? null },
    { org_id: orgId, staff_name: "Devon Park", department: "Server", completion_pct: 85, occurred_on: isoDay(28), created_by: userId, staff_id: staffByName.get("Devon Park")?.id ?? null },
    { org_id: orgId, staff_name: "Sam Turner", department: "Bartender", completion_pct: 95, occurred_on: isoDay(21), created_by: userId, staff_id: staffByName.get("Sam Turner")?.id ?? null },
    { org_id: orgId, staff_name: "Nadia Khan", department: "Server", completion_pct: 80, occurred_on: isoDay(14), created_by: userId, staff_id: staffByName.get("Nadia Khan")?.id ?? null },
    { org_id: orgId, staff_name: "Elena Vasquez", department: "Server", completion_pct: 45, occurred_on: isoDay(7), created_by: userId, staff_id: staffByName.get("Elena Vasquez")?.id ?? null },
    { org_id: orgId, staff_name: "Sofia Marin", department: "Server", completion_pct: 30, occurred_on: isoDay(4), created_by: userId, staff_id: staffByName.get("Sofia Marin")?.id ?? null },
  ]);

  // Tests & exams — the Food + Bartender examples, with a live assignment board
  // (someone passed, someone in progress, someone locked out) and a test
  // assigned to the demo viewer so they can experience taking it as a staffer.
  const seedTest = async (key: string): Promise<string | null> => {
    const ex = EXAMPLE_TESTS.find((e) => e.key === key);
    if (!ex) return null;
    const { data: t, error: tErr } = await admin
      .from("tests")
      .insert({
        org_id: orgId, title: ex.settings.title, description: ex.settings.description, mode: ex.settings.mode,
        target_departments: ex.settings.target_departments, day_count: ex.settings.day_count, pass_pct: ex.settings.pass_pct,
        max_retakes: ex.settings.max_retakes, complete_within_amount: ex.settings.complete_within_amount,
        complete_within_unit: ex.settings.complete_within_unit, rotates_monthly: ex.settings.rotates_monthly,
        source: "example", created_by: userId,
      })
      .select("id")
      .single();
    // Don't fail silently: a null here skips the whole assignments block below,
    // which is exactly how the demo viewer ends up with no "tests to take".
    if (tErr || !t) {
      console.error(`[demo] seedTest("${key}") failed to insert:`, tErr?.message ?? "no row returned");
      return null;
    }
    const testId = t.id as string;
    await admin.from("test_days").insert(ex.days.map((d) => ({ test_id: testId, org_id: orgId, day_number: d.day_number, title: d.title, content: d.content })));
    await admin.from("test_questions").insert(
      ex.questions.map((qq, i) => ({ test_id: testId, org_id: orgId, day_number: qq.day_number, sort_order: i, kind: qq.kind, prompt: qq.prompt, options: qq.options, correct_index: qq.correct_index, explanation: qq.explanation }))
    );
    return testId;
  };
  const foodTestId = await seedTest("food");
  const bartenderTestId = await seedTest("bartender");
  const kitchenTestId = await seedTest("kitchen");
  const ltoTestId = await seedTest("lto"); // study_quiz: read the content, then take the quiz on it

  // A staff record linked to the demo viewer's own login, so "Assigned to you"
  // appears and they can take the test live during a walkthrough.
  const { data: viewerStaff } = await admin
    .from("staff_members")
    .insert({ org_id: orgId, location_id: downtown, full_name: "Alex Kim", department: "Server", email: DEMO_EMAIL, phone: "(512) 555-0320", status: "active", hired_on: isoDay(120), profile_id: userId })
    .select("id")
    .single();

  if (foodTestId) {
    const dueSoon = isoTs(-5); // ~5 days out
    const locByName: Record<string, string> = { "Maya Rivera": downtown, "Elena Vasquez": downtown, "Sofia Marin": riverside, "Nadia Khan": riverside };
    const forStaff = (name: string, extra: Record<string, unknown>) => {
      const s = staffByName.get(name);
      return s ? { org_id: orgId, test_id: foodTestId, staff_id: s.id, location_id: locByName[name] ?? downtown, assigned_by: userId, due_at: dueSoon, ...extra } : null;
    };
    const assignments = [
      viewerStaff ? { org_id: orgId, test_id: foodTestId, staff_id: viewerStaff.id, location_id: downtown, assigned_by: userId, due_at: dueSoon, status: "assigned", current_day: 1 } : null,
      // A learn-then-quiz (study_quiz) test to take, so the demo shows reading the
      // content and then being quizzed on it.
      viewerStaff && ltoTestId ? { org_id: orgId, test_id: ltoTestId, staff_id: viewerStaff.id, location_id: downtown, assigned_by: userId, due_at: dueSoon, status: "assigned", current_day: 1 } : null,
      // Past results for the demo viewer, so their "tests taken / results" show.
      viewerStaff && bartenderTestId ? { org_id: orgId, test_id: bartenderTestId, staff_id: viewerStaff.id, location_id: downtown, assigned_by: userId, due_at: isoTs(20), status: "passed", current_day: 1, attempts_used: 1, best_score: 88, last_score: 88, passed_at: isoTs(15) } : null,
      viewerStaff && kitchenTestId ? { org_id: orgId, test_id: kitchenTestId, staff_id: viewerStaff.id, location_id: downtown, assigned_by: userId, due_at: isoTs(30), status: "passed", current_day: 1, attempts_used: 1, best_score: 95, last_score: 95, passed_at: isoTs(25) } : null,
      forStaff("Maya Rivera", { status: "passed", current_day: 5, attempts_used: 1, best_score: 92, last_score: 92, passed_at: isoTs(2) }),
      forStaff("Elena Vasquez", { status: "locked", current_day: 1, attempts_used: 2, best_score: 60, last_score: 60, locked_at: isoTs(1), locked_alerted: true }),
      forStaff("Sofia Marin", { status: "in_progress", current_day: 2, attempts_used: 0 }),
      forStaff("Nadia Khan", { status: "assigned", current_day: 1 }),
    ].filter(Boolean) as Record<string, unknown>[];
    if (assignments.length) {
      const { error: aErr } = await admin.from("test_assignments").insert(assignments);
      if (aErr) console.error("[demo] test_assignments insert failed:", aErr.message);
    }
  } else {
    console.error("[demo] no example tests were created (foodTestId null) — skipping all test assignments.");
  }

  // Accountability checklist templates.
  await admin.from("accountability_checklist_items").insert([
    ...["Dining room reset and wiped down", "Menus cleaned and stocked at host stand", "Bar restocked to par and garnishes cut", "POS terminals tested and drawers counted", "Restrooms checked and stocked", "Music and lighting set to service levels"].map((item, i) => ({ org_id: orgId, checklist_type: "daily", item, sort_order: i, source: "wingman" })),
    ...["Today's specials reviewed with the team", "One culture focus for the shift set", "VIPs and large parties flagged", "86'd items communicated", "Sections and rotation assigned", "Energy check — everyone ready"].map((item, i) => ({ org_id: orgId, checklist_type: "preshift", item, sort_order: i, source: "wingman" })),
  ]);

  // Operational logs — discounts, spot checks, checklists, coaching, ambiance.
  await admin.from("discounts").insert([
    { org_id: orgId, location_id: downtown, occurred_on: isoDay(2), server_name: "Devon Park", category: "Service recovery", reason: "Slow entree fire", amount: 24, notes: "Comped one entree, table recovered.", created_by: userId },
    { org_id: orgId, location_id: downtown, occurred_on: isoDay(5), server_name: "Maya Rivera", category: "Celebration", reason: "Anniversary dessert", amount: 12, notes: "", created_by: userId },
    { org_id: orgId, location_id: riverside, occurred_on: isoDay(6), server_name: "Nadia Khan", category: "Service recovery", reason: "Wrong drink twice", amount: 15, notes: "Bar backed up.", created_by: userId },
    { org_id: orgId, location_id: riverside, occurred_on: isoDay(9), server_name: "Tomás Reyes", category: "Manager comp", reason: "First-timer welcome", amount: 16, notes: "", created_by: userId },
    { org_id: orgId, location_id: downtown, occurred_on: isoDay(12), server_name: "Elena Vasquez", category: "Service recovery", reason: "Overcooked steak", amount: 34, notes: "Re-fired, guest happy.", created_by: userId },
    { org_id: orgId, location_id: downtown, occurred_on: isoDay(16), server_name: "Chris Doyle", category: "Discount", reason: "Loyalty reward", amount: 20, notes: "", created_by: userId },
    { org_id: orgId, location_id: riverside, occurred_on: isoDay(20), server_name: "Sofia Marin", category: "Service recovery", reason: "Long wait, no update", amount: 28, notes: "Coached host on wait comms.", created_by: userId },
  ]);

  await admin.from("spot_checks").insert([
    { org_id: orgId, location_id: downtown, staff_name: "Maya Rivera", department: "Server", occurred_on: isoDay(3), scores: [5, 5, 4, 5], felt_like_transaction: false, notes: "Textbook recommendation flow.", created_by: userId },
    { org_id: orgId, location_id: downtown, staff_name: "Elena Vasquez", department: "Server", occurred_on: isoDay(6), scores: [3, 4, 3, 3], felt_like_transaction: true, notes: "Skipped the loyalty mention.", created_by: userId },
    { org_id: orgId, location_id: riverside, staff_name: "Nadia Khan", department: "Server", occurred_on: isoDay(4), scores: [5, 4, 5, 4], felt_like_transaction: false, notes: "", created_by: userId },
    { org_id: orgId, location_id: riverside, staff_name: "Hannah Cole", department: "Host", occurred_on: isoDay(8), scores: [3, 3, 2, 3], felt_like_transaction: true, notes: "Slow greet during rush.", created_by: userId },
    { org_id: orgId, location_id: downtown, staff_name: "Sam Turner", department: "Bartender", occurred_on: isoDay(10), scores: [5, 5, 5, 4], felt_like_transaction: false, notes: "Remembered a regular's order.", created_by: userId },
    { org_id: orgId, location_id: riverside, staff_name: "Sofia Marin", department: "Server", occurred_on: isoDay(13), scores: [4, 3, 4, 3], felt_like_transaction: false, notes: "Improving on pacing.", created_by: userId },
  ]);

  await admin.from("daily_checklists").insert([
    { org_id: orgId, location_id: downtown, manager_name: "Marcus Lee", occurred_on: isoDay(1), checked: [true, true, true, true, true, true], notes: "Clean open.", created_by: userId },
    { org_id: orgId, location_id: downtown, manager_name: "Marcus Lee", occurred_on: isoDay(2), checked: [true, true, true, false, true, true], notes: "Drawer recount needed.", created_by: userId },
    { org_id: orgId, location_id: riverside, manager_name: "Ryan Foster", occurred_on: isoDay(1), checked: [true, true, true, true, true, true], notes: "", created_by: userId },
    { org_id: orgId, location_id: riverside, manager_name: "Ryan Foster", occurred_on: isoDay(3), checked: [true, false, true, true, true, false], notes: "Bar low on garnish, music late.", created_by: userId },
  ]);

  await admin.from("coaching_logs").insert([
    { org_id: orgId, location_id: downtown, flag_text: "Elena skipped the loyalty mention on a first-time table.", strategy_note: "Role-play the loyalty line before Friday service.", occurred_on: isoDay(6), created_by: userId },
    { org_id: orgId, location_id: riverside, flag_text: "Slow greets during the 7pm rush at the host stand.", strategy_note: "Add a second host to the door Thu–Sat 6–8pm.", occurred_on: isoDay(8), created_by: userId },
    { org_id: orgId, location_id: riverside, flag_text: "Sofia's pacing on multi-course tables is behind.", strategy_note: "Shadow Nadia for one weekend service.", occurred_on: isoDay(13), created_by: userId },
    { org_id: orgId, location_id: downtown, flag_text: "Bar backing up on Saturdays.", strategy_note: "Prep garnishes and batch two cocktails before doors.", occurred_on: isoDay(15), created_by: userId },
  ]);

  await admin.from("pre_shift_checks").insert([
    { org_id: orgId, location_id: downtown, staff_name: "Maya Rivera", department: "Server", checked: [true, true, true, true], occurred_on: isoDay(1), created_by: userId },
    { org_id: orgId, location_id: downtown, staff_name: "Devon Park", department: "Server", checked: [true, true, false, true], occurred_on: isoDay(1), created_by: userId },
    { org_id: orgId, location_id: riverside, staff_name: "Nadia Khan", department: "Server", checked: [true, true, true, true], occurred_on: isoDay(2), created_by: userId },
    { org_id: orgId, location_id: riverside, staff_name: "Tomás Reyes", department: "Bartender", checked: [true, false, true, true], occurred_on: isoDay(2), created_by: userId },
  ]);

  await admin.from("ambiance_checks").insert([
    { org_id: orgId, location_id: downtown, scores: [5, 4, 5, 5], notes: "Warm light, music on point.", occurred_on: isoDay(1), created_by: userId },
    { org_id: orgId, location_id: downtown, scores: [4, 4, 3, 4], notes: "Entry a little cold.", occurred_on: isoDay(4), created_by: userId },
    { org_id: orgId, location_id: riverside, scores: [5, 5, 4, 5], notes: "Patio golden hour is perfect.", occurred_on: isoDay(2), created_by: userId },
    { org_id: orgId, location_id: riverside, scores: [3, 4, 4, 3], notes: "Music too loud pre-7pm.", occurred_on: isoDay(6), created_by: userId },
  ]);

  await admin.from("shift_checklist_completions").insert([
    { org_id: orgId, location_id: downtown, profile_id: userId, checklist_type: "preshift", occurred_on: isoDay(1), checked: [true, true, true, true, true, true], item_count: 6, completed_count: 6 },
    { org_id: orgId, location_id: downtown, profile_id: userId, checklist_type: "daily", occurred_on: isoDay(2), checked: [true, true, true, false, true, true], item_count: 6, completed_count: 5 },
    { org_id: orgId, location_id: riverside, profile_id: userId, checklist_type: "preshift", occurred_on: isoDay(3), checked: [true, true, false, true, true, false], item_count: 6, completed_count: 4 },
  ]);

  // Standout audits (health + 5-gap diagnosis) over time, per location.
  await admin.from("audits").insert([
    { org_id: orgId, location_id: downtown, occurred_on: isoDay(75), gap_scores: [3, 4, 3, 2, 3], domain_scores: [3, 3, 4, 3, 2, 3], health_score: 62, audit_score: 58, action_plan: "Tighten the greeting and first-drink speed. Build the loyalty mention into every server's flow.", created_by: userId },
    { org_id: orgId, location_id: downtown, occurred_on: isoDay(18), gap_scores: [4, 5, 4, 4, 4], domain_scores: [4, 5, 4, 4, 4, 4], health_score: 84, audit_score: 81, action_plan: "Sustain the recommendation habit. Focus next on cross-location consistency.", created_by: userId },
    { org_id: orgId, location_id: riverside, occurred_on: isoDay(60), gap_scores: [3, 3, 4, 3, 3], domain_scores: [3, 4, 3, 3, 3, 4], health_score: 66, audit_score: 64, action_plan: "Add a second host during peak. Coach pacing on multi-course tables.", created_by: userId },
    { org_id: orgId, location_id: riverside, occurred_on: isoDay(10), gap_scores: [4, 4, 4, 4, 5], domain_scores: [4, 4, 4, 5, 4, 4], health_score: 80, audit_score: 78, action_plan: "Greeting speed fixed. Dial in ambiance timing (music before 7pm).", created_by: userId },
  ]);

  // Business health metrics — 8 weeks per location.
  const healthRows: Record<string, unknown>[] = [];
  const base = [
    { loc: downtown, netSales: 96000, laborPct: 0.28, laborRate: 22, comp: 900, covers: 1250, seats: 120 },
    { loc: riverside, netSales: 74000, laborPct: 0.30, laborRate: 21, comp: 1100, covers: 980, seats: 96 },
  ];
  for (let w = 7; w >= 0; w--) {
    for (const b of base) {
      const growth = 1 + (7 - w) * 0.015; // slow upward trend
      const netSales = Math.round(b.netSales * growth);
      const laborCost = Math.round(netSales * b.laborPct);
      const laborHours = Math.round(laborCost / b.laborRate);
      const covers = Math.round(b.covers * growth);
      healthRows.push({
        org_id: orgId, location_id: b.loc, period_date: weekStart(w),
        net_sales: netSales, labor_cost: laborCost, labor_hours: laborHours,
        comp_cost: b.comp, covers, checks: Math.round(covers / 2.1), seats: b.seats, created_by: userId,
      });
    }
  }
  await admin.from("business_health_metrics").insert(healthRows);

  // Growth plans (10/10/10) — org-wide + per location.
  await admin.from("growth_plans").insert([
    { org_id: orgId, location_id: null, frequency: "monthly", current_customers: 4200, current_avg_sale: 58, current_repurchase_frequency: 1.4, uniform_pct: 10, target_customers_pct: 15, target_avg_sale_pct: 12, target_frequency_pct: 20, retained_years: 2.5, avg_acquisition_cost: 18, updated_by: userId },
    { org_id: orgId, location_id: downtown, frequency: "monthly", current_customers: 2400, current_avg_sale: 61, current_repurchase_frequency: 1.5, uniform_pct: 10, target_customers_pct: 15, target_avg_sale_pct: 12, target_frequency_pct: 20, retained_years: 2.8, avg_acquisition_cost: 17, updated_by: userId },
    { org_id: orgId, location_id: riverside, frequency: "monthly", current_customers: 1800, current_avg_sale: 54, current_repurchase_frequency: 1.3, uniform_pct: 10, target_customers_pct: 18, target_avg_sale_pct: 12, target_frequency_pct: 22, retained_years: 2.2, avg_acquisition_cost: 19, updated_by: userId },
  ]);

  const entryRows: Record<string, unknown>[] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - m, 1);
    const period = d.toISOString().slice(0, 10);
    const step = 5 - m;
    entryRows.push({ org_id: orgId, location_id: null, period_date: period, customers: 4200 + step * 90, avg_sale: 58 + step * 0.8, repurchase_frequency: 1.4 + step * 0.03, created_by: userId });
  }
  await admin.from("growth_plan_entries").insert(entryRows);

  // Team playbook.
  await admin.from("playbook_articles").insert(
    PLAYBOOK.map(([title, body], i) => ({ org_id: orgId, title, body, sort_order: i, created_by: userId }))
  );

  // Scheduled report.
  await admin.from("report_schedules").insert({
    org_id: orgId, frequency: "weekly", sections: ["culture", "guests", "training", "health"],
    recipient_emails: ["owner@lanternvine.com"], created_by: userId,
  });

  // -------------------------------------------------------------------------
  // Partners (B2B / Community) — local businesses, a mix of warm and fading
  // relationships, a few booked events/fundraisers with revenue. Tuned so the
  // KPI + goal cards and the Needs-Follow-up hit list all show real numbers.
  // `age` backdates created_at so only some count as "new this quarter"; each
  // activity's date drives last_activity_at (via the DB trigger) and the
  // this-quarter counters. Revenue on booked events/fundraisers totals $7,239.
  // -------------------------------------------------------------------------
  type SeedActivity = { type: "call_text" | "email" | "meeting" | "event_booked" | "fundraiser_booked"; days: number; revenue?: number; notes?: string };
  const PARTNERS: { company: string; contact: string; title: string; email: string; phone: string; category: string; loc: number; age: number; address: string; notes: string; acts: SeedActivity[] }[] = [
    { company: "Halcyon Marketing Group", contact: "Priya Nair", title: "Office Manager", email: "priya@halcyonmktg.com", phone: "(313) 555-0142", category: "Corporate Office", loc: 0, age: 6, address: "120 Woodward Ave, Suite 400", notes: "Met at the Downtown Chamber mixer. 40-person office, always looking for team lunches.", acts: [
      { type: "meeting", days: 20, notes: "Toured our private room for their quarterly all-hands." },
      { type: "event_booked", days: 5, revenue: 240000, notes: "Booked catered lunch for 40 — quarterly all-hands." },
    ] },
    { company: "Riverside High School", contact: "Coach Dan Whitmore", title: "Athletic Director", email: "dwhitmore@riversideschools.org", phone: "(313) 555-0187", category: "School / University", loc: 1, age: 34, address: "800 Riverside Dr", notes: "Booster club does spirit nights. Big fundraiser potential each season.", acts: [
      { type: "call_text", days: 18 },
      { type: "fundraiser_booked", days: 8, revenue: 183900, notes: "Spirit night — 15% of sales to the booster club." },
    ] },
    { company: "Cornerstone Community Church", contact: "Pastor Alicia Reed", title: "Events Lead", email: "events@cornerstone.org", phone: "(313) 555-0210", category: "Non-profit", loc: 0, age: 51, address: "45 Grand River Ave", notes: "Hosts a monthly community dinner. Values local partnerships.", acts: [
      { type: "fundraiser_booked", days: 3, revenue: 90000, notes: "Fundraiser gala dessert sponsorship." },
    ] },
    { company: "Peak Performance Gym", contact: "Marco Silva", title: "Owner", email: "marco@peakperformance.fit", phone: "(313) 555-0133", category: "Gym / Studio", loc: 0, age: 12, address: "220 Cass Ave", notes: "Post-workout smoothie/protein crowd. Open to a member perk deal.", acts: [
      { type: "email", days: 9, notes: "Sent over a member-perk proposal." },
      { type: "event_booked", days: 10, revenue: 60000, notes: "Catered their trainer appreciation night." },
    ] },
    { company: "Downtown Chamber of Commerce", contact: "Janet Cole", title: "Membership Director", email: "jcole@downtownchamber.org", phone: "(313) 555-0166", category: "Chamber of Commerce", loc: 0, age: 60, address: "1 Campus Martius", notes: "Gateway to every business downtown. Host a mixer here.", acts: [
      { type: "meeting", days: 12, notes: "Pitched hosting the Q4 business mixer at our place." },
      { type: "event_booked", days: 12, revenue: 150000, notes: "Booked the fall business mixer — happy-hour buyout." },
    ] },
    { company: "Lakeside Dental", contact: "Dr. Ruth Kim", title: "Practice Owner", email: "office@lakesidedental.com", phone: "(313) 555-0198", category: "Medical / Dental", loc: 1, age: 40, address: "560 Jefferson Ave", notes: "Staff of 12. Does a monthly team lunch — currently rotating spots.", acts: [
      { type: "call_text", days: 22, notes: "Left a voicemail about their monthly team lunch." },
    ] },
    { company: "Meridian Real Estate", contact: "Tom Bradley", title: "Broker", email: "tom@meridianre.com", phone: "(313) 555-0175", category: "Real Estate", loc: 0, age: 47, address: "88 Monroe St", notes: "Does client closing dinners and open-house catering.", acts: [
      { type: "email", days: 26, notes: "Intro email + catering menu." },
    ] },
    { company: "Brightside Pediatrics", contact: "Nina Alvarez", title: "Office Coordinator", email: "nina@brightsidepeds.com", phone: "(313) 555-0119", category: "Medical / Dental", loc: 1, age: 55, address: "300 Riverside Dr", notes: "Staff appreciation lunches quarterly.", acts: [
      { type: "call_text", days: 44, notes: "Talked about their next staff appreciation day." },
    ] },
    // Fading — 30+ days since last touch (Hit List).
    { company: "Anchor Financial", contact: "Greg Foltz", title: "Branch Manager", email: "gfoltz@anchorfin.com", phone: "(313) 555-0124", category: "Corporate Office", loc: 0, age: 70, address: "500 Griswold St", notes: "Client-appreciation events a couple times a year.", acts: [
      { type: "meeting", days: 48, notes: "Discussed catering their client-appreciation happy hour." },
    ] },
    { company: "Willowbrook Senior Living", contact: "Carla Jimenez", title: "Activities Director", email: "cjimenez@willowbrook.org", phone: "(313) 555-0155", category: "Non-profit", loc: 1, age: 66, address: "1200 Lakeshore Blvd", notes: "Family nights — big catering orders when they run them.", acts: [
      { type: "email", days: 52, notes: "Followed up on a family-night catering quote." },
    ] },
    { company: "Ignite Coworking", contact: "Dev Patel", title: "Community Manager", email: "dev@ignitecowork.com", phone: "(313) 555-0102", category: "Corporate Office", loc: 0, age: 58, address: "77 W Fort St", notes: "150 members. Does Friday member lunches.", acts: [
      { type: "call_text", days: 61, notes: "Left a note about a recurring Friday lunch deal." },
    ] },
    { company: "Grandview Elementary PTA", contact: "Monica Shaw", title: "PTA President", email: "pta@grandview.org", phone: "(313) 555-0188", category: "School / University", loc: 1, age: 72, address: "410 Grandview Ave", notes: "Restaurant nights are their go-to fundraiser.", acts: [
      { type: "meeting", days: 70, notes: "Talked through a spring restaurant-night fundraiser." },
    ] },
    // Never contacted — brand-new leads (Hit List).
    { company: "Nova Tech Solutions", contact: "Alan Wu", title: "HR Lead", email: "awu@novatech.io", phone: "(313) 555-0140", category: "Corporate Office", loc: 0, age: 4, address: "1450 Woodward Ave", notes: "New office opening downtown — 60 employees. Cold lead from the chamber list.", acts: [] },
    { company: "Sunrise Yoga Studio", contact: "Bella Ortiz", title: "Owner", email: "hello@sunriseyoga.com", phone: "(313) 555-0171", category: "Gym / Studio", loc: 1, age: 3, address: "250 Riverside Dr", notes: "Wellness crowd. Could do a smoothie pop-up partnership.", acts: [] },
    { company: "Harbor Point Hotel", contact: "James Okafor", title: "Guest Services Manager", email: "jokafor@harborpoint.com", phone: "(313) 555-0159", category: "Hotel / Lodging", loc: 1, age: 9, address: "900 Harbor Point", notes: "Refers guests for dinner. Concierge partnership idea.", acts: [] },
    { company: "Blue Line Fitness", contact: "Tara Nguyen", title: "GM", email: "tara@bluelinefit.com", phone: "(313) 555-0148", category: "Gym / Studio", loc: 0, age: 2, address: "330 Michigan Ave", notes: "Cold lead — walk-in introduction.", acts: [] },
    { company: "Evergreen Nonprofit Alliance", contact: "Ruth Bell", title: "Development Director", email: "rbell@evergreenalliance.org", phone: "(313) 555-0181", category: "Non-profit", loc: 1, age: 38, address: "150 Jefferson Ave", notes: "Runs three fundraising galas a year.", acts: [
      { type: "call_text", days: 25, notes: "Great call — interested in a fall fundraiser night." },
    ] },
    { company: "Metro Law Partners", contact: "David Osei", title: "Office Administrator", email: "dosei@metrolaw.com", phone: "(313) 555-0193", category: "Corporate Office", loc: 0, age: 15, address: "660 Woodward Ave", notes: "Client lunches + a holiday party each year.", acts: [
      { type: "email", days: 14, notes: "Sent the holiday-party private-dining packet." },
    ] },
  ];

  const partnerContactRows = PARTNERS.map((p) => ({
    org_id: orgId,
    location_id: locationIds[p.loc],
    company_name: p.company,
    contact_name: p.contact,
    title: p.title,
    email: p.email,
    phone: p.phone,
    category: p.category,
    website: "",
    address: p.address,
    notes: p.notes,
    status: "active",
    created_by: userId,
    created_at: isoTs(p.age),
    updated_at: isoTs(p.age),
  }));
  const { data: pcRows } = await admin.from("partner_contacts").insert(partnerContactRows).select("id, company_name");
  const partnerIdByCompany = new Map((pcRows ?? []).map((r) => [r.company_name as string, r.id as string]));

  const partnerActivityRows: Record<string, unknown>[] = [];
  for (const p of PARTNERS) {
    const cid = partnerIdByCompany.get(p.company);
    if (!cid) continue;
    for (const a of p.acts) {
      partnerActivityRows.push({
        org_id: orgId,
        contact_id: cid,
        location_id: locationIds[p.loc],
        activity_date: isoDay(a.days),
        activity_type: a.type,
        notes: a.notes ?? "",
        revenue_cents: a.revenue ?? null,
        created_by: userId,
      });
    }
  }
  if (partnerActivityRows.length) await admin.from("partner_activities").insert(partnerActivityRows);

  // Standing goals: the owner's chosen defaults (20 new contacts, 3 events,
  // 3 fundraisers, 20 active connections per quarter).
  await admin.from("partner_goals").insert({
    org_id: orgId, location_id: null,
    goal_new_contacts: 20, goal_events: 3, goal_fundraisers: 3, goal_active_connections: 20,
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Full reseed: ensure the demo auth user, org, locations and profile exist,
 * wipe all tenant content for the demo org, then repopulate the showcase.
 * Idempotent and safe to call on every demo login.
 *
 * Pass `knownUserId` when the caller already resolved the demo user (login does,
 * just before sign-in) to skip a second paginated auth-user lookup.
 */
export async function reseedDemoOrg(knownUserId?: string): Promise<DemoContext> {
  const userId = knownUserId ?? (await ensureDemoUser());
  const ctx = await ensureDemoOrg(userId);
  await wipeDemoOrg(ctx.orgId);
  await populateDemoOrg(ctx);
  return ctx;
}

// ---------------------------------------------------------------------------
// Per-visitor sandboxes ("Try the live demo" funnel)
// ---------------------------------------------------------------------------

/**
 * Provisions a brand-new, fully-isolated demo sandbox: a throwaway auth user, a
 * fresh org (marked ephemeral via demo_expires_at), two locations, a super-admin
 * profile, and the full seeded showcase. Returns credentials the caller uses to
 * sign the visitor in. The org auto-expires and is reaped by /api/cron/demo-cleanup.
 *
 * Unlike the shared wingmandemo org, each call creates a NEW org, so any number
 * of visitors can explore and edit concurrently without touching each other.
 */
export async function provisionDemoSandbox(
  lead?: { leadEmail?: string; leadName?: string }
): Promise<{ email: string; password: string; orgId: string }> {
  const admin = createAdminClient();

  // Throwaway identity. No email is ever sent (email_confirm: true), so the
  // domain only needs to be syntactically valid. The captured lead email is
  // stashed in metadata so a sandbox can be traced back to a prospect.
  const token = randomUUID();
  const email = `demo-${token}@demo.wingman.app`;
  const password = `${randomUUID()}Aa1!`;

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: lead?.leadName || "Demo Visitor",
      demo_sandbox: true,
      lead_email: lead?.leadEmail ?? null,
    },
  });
  if (userErr || !created.user) throw userErr ?? new Error("Failed to create sandbox user");
  const userId = created.user.id;

  const expiresAt = new Date(Date.now() + SANDBOX_TTL_HOURS * 3600 * 1000).toISOString();
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: ORG_NAME, is_demo: true, demo_expires_at: expiresAt })
    .select("id")
    .single();
  if (orgErr || !org) {
    // Don't leave an orphan auth user behind if the org insert fails.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw orgErr ?? new Error("Failed to create sandbox org");
  }
  const orgId = org.id as string;

  const locationIds: string[] = [];
  for (const want of LOCATIONS) {
    const { data: loc, error } = await admin
      .from("locations")
      .insert({ org_id: orgId, ...want })
      .select("id")
      .single();
    if (error || !loc) throw error ?? new Error("Failed to create sandbox location");
    locationIds.push(loc.id as string);
  }

  const { error: profErr } = await admin.from("profiles").insert({
    id: userId,
    org_id: orgId,
    full_name: "Demo Visitor",
    access_role: "super_admin",
    location_id: null,
    all_locations: true,
  });
  if (profErr) throw profErr;

  await populateDemoOrg({ userId, orgId, locationIds });
  return { email, password, orgId };
}

/**
 * Reaps expired sandbox orgs and their throwaway users. Deleting the auth user
 * cascade-deletes its profile; deleting the org cascade-deletes all tenant data.
 * Called by the demo-cleanup cron.
 */
export async function cleanupExpiredSandboxes(): Promise<{ orgs: number; users: number }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: expired, error } = await admin
    .from("organizations")
    .select("id")
    .eq("is_demo", true)
    .not("demo_expires_at", "is", null)
    .lt("demo_expires_at", now)
    .limit(500);
  if (error) throw error;

  let orgs = 0;
  let users = 0;
  for (const o of expired ?? []) {
    const orgId = (o as { id: string }).id;
    const { data: profs } = await admin.from("profiles").select("id").eq("org_id", orgId);
    for (const p of profs ?? []) {
      const { error: delErr } = await admin.auth.admin.deleteUser((p as { id: string }).id);
      if (!delErr) users++;
    }
    const { error: orgDelErr } = await admin.from("organizations").delete().eq("id", orgId);
    if (!orgDelErr) orgs++;
  }
  return { orgs, users };
}
