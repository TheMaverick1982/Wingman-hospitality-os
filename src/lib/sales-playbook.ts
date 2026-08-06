// -----------------------------------------------------------------------------
// Sales / demo playbook.
//
// Reference material for platform staff who run demos of Wingman for restaurant
// operators. It is curated by us and maintained in code (like the Help Center),
// shared across all demo staff. Rendered read-only at /admin/sales-training.
//
// The whole ethos: we are a guide, not a closer. Everything here is a guardrail,
// never a script to read word-for-word. If Wingman isn't right for an operator,
// the rep should say so — one honest "not yet" beats a bad-fit sale every time.
// -----------------------------------------------------------------------------

// A new rep should be able to learn what Wingman actually is from this section
// alone — before they ever run a demo. Keep this in plain, operator-facing
// language: what it is, why it matters, and what each part does.

export const PRODUCT_ONE_LINER =
  "Wingman is the retention layer for restaurants — it turns first-time guests into regulars through the culture, training, and accountability a team runs every shift.";

export const WHY_IT_MATTERS: string[] = [
  "Winning a new guest costs far more than keeping one. Most restaurants pour everything into getting people in the door and almost nothing into bringing them back — that gap is the whole opportunity.",
  "Great food isn't a system. When the owner is off, the experience often slips. Wingman makes the standard something you can train to, check, and hold — not something that lives only in the owner's head.",
  "A few more regulars a month, held consistently, is the difference between a restaurant that grinds and one that compounds.",
  "You can't deliver a consistent guest experience through a revolving door. The brands operators admire — In-N-Out, Chick-fil-A — win on guest experience because they win on people first: purpose, pride, and a reason to stay. Wingman builds that into the training for every role, so better staff retention and better guest retention come from the same system.",
];

export type ProductArea = { name: string; what: string; problem: string };

export const PRODUCT_TOUR: ProductArea[] = [
  { name: "Guest Reviews (survey)", what: "A guest-experience survey with a per-location QR code + short branded link (joinwingman.app/s/…) — put it on a table tent, receipt, or window, or text/email it. Guests rate food, service, and likelihood to return, can name who served them (first names only, for a shout-out), and leave a comment. Responses land in a Guest Reviews archive with response count, average rating, and rave-review count, filterable by location, and each location's link tracks scans. Deliberately SEPARATE from Guest Bounce Back — a survey never adds a guest or counts as a visit, so repeat-rate data stays clean — with a match-ONLY link to a guest who's already in Bounce Back. (Coming next: an AI 'here's what guests love and where to improve' summary, and positive shout-outs highlighting the server on the dashboard for the whole team.)", problem: "Operators fly blind on how guests actually felt until a one-star Google review shows up days later. This captures first-party feedback in the moment, at the table, per location — problems surface fast, wins get seen — without polluting the retention numbers. It also supplies the guest-experience half of the retention story the whole product is built around, and doubles as a recognition engine when a guest calls out their server by name." },
  { name: "Guest Bounce Back", what: "Logs guests and their return visits (with the bill total at each visit), then hands you the action lists: a win-back list of guests who've gone quiet 30+ days, and a 'ready to refer' list of your happiest guests who haven't referred anyone yet. A retention drop-off coach spots the visit where the most guests stop coming back (and, for multi-location operators, which store it's worst at), then asks 3 questions and writes a this-week plan to fix it. A 'Revenue by visit' report shows the actual dollars each visit stage generated — the repeat-visit total is the program's real ROI.", problem: "Owners have no idea who came once and never returned, or why — this makes the first-timer-to-regular journey visible, tells the team exactly who to call, win back, and ask for a referral, turns 'we're losing people after visit 2' into a concrete plan, and proves the ROI in real dollars: 'here's the actual revenue your repeat visits brought in' beats any estimate." },
  { name: "Guest Journey", what: "Maps the whole guest experience into ordered moments, each with a standard, a script, and what a manager inspects — and lets the host log a first-timer at the door straight into Bounce Back. The operator describes their restaurant in their own words and Wingman recommends a full journey they approve; afterward they can request changes in plain English ('add a wine-pairing moment', 'what am I missing?') and approve the AI's proposed add/edit/remove — same build-from-your-words, AI-recommends, you-approve flow as Training and Hiring.", problem: "The experience is left to chance and memory; this turns it into a designed, repeatable playbook built from the operator's own way of doing things (not a generic template), keeps it easy to evolve, and makes sure no first-time guest slips away uncaptured." },
  { name: "Culture", what: "Captures the owner's standard, core values, and weekly focus in their own words — anchored by the Owner's Mindset: a short 'run it like you own it' manifesto (imagine your own savings are on the line; every guest is why the doors stay open) that the owner writes or drafts with AI, every hire reads at the top of their role guide, and that grounds the Ask Wingman assistant and all AI generation. It's the culture core the rest of the product hangs on.", problem: "Culture is felt but never written down, so it can't be trained or scaled to new hires and second locations — and 'take pride in your work' is too vague to change behavior. The Owner's Mindset turns culture into a concrete, ownership-framed standard every role feels and every shift is held to, and because it feeds the AI, that mindset shows up in the training, role guides, and answers staff actually see." },
  { name: "Training & Standards", what: "Builds role-by-role training programs with a real sign-off log, plus a Tests & exams area: auto-scored multiple-choice / true-false tests built by AI, from a role's own training, or from ready-made Food/Bartender examples — with owner-set pass %, retakes, multi-day pacing, deadlines, role targeting, and a learn-then-quiz mode for a new LTO/menu that can rotate monthly to all staff. Any role's training becomes a test in one click — \"Turn into a test\" sits right under the role's training program, shows a live \"building your test…\" indicator while the AI writes it, then hands you a \"Review & edit\" step so you read it over before assigning anyone (and \"Update the test\" regenerates it when the training changes). In the editor you can add or remove days on the fly — each day carries its own learning section plus its own questions — and trainees can work ahead through the days in one sitting. A one-click Preview (next to each test, and at the top of the test's page) walks the owner through the test exactly as staff see it — day by day, learning then questions, nothing saved — with a manager-only \"Show answer key\" toggle for reviewing correctness. The front door for handing them out is a prominent \"Start a test\" button on the Training page: pick who takes it (one person, a role, or all staff), check off the test(s) — hand out several at once — set an optional due date, and send. Everyone's emailed a link (one email even for multiple tests), they take it a day at a time, it auto-scores, and a results board shows who passed and who hasn't. If someone burns all their retakes it locks and emails the location's manager to coach and unlock; if a deadline passes unfinished, the manager gets an overdue nudge too — both routed to the location's email on file. And because hospitality is a habit, not a one-time course, there's a dedicated Continuing Education area (Training → 'Make great hospitality a habit'): a guided AI builder asks a couple of sharpening questions (what slipped, the reaction guests should have, the standard to hold) and offers role-aware idea chips, then drafts a short learn-then-quiz 'day one' the owner reviews and edits. On the 1st of every month Wingman re-assigns each refresher to the roles it targets as a fresh attempt and emails everyone a link — a core hospitality refresher for all staff, plus role-specific add-ons (a bartender's drink specs, a line cook's plating) that only reach that department — all with the same reminders and results tracking.", problem: "New hires 'pick it up as they go,' so the experience drifts — and owners have no proof anyone actually learned the standards. This makes training consistent AND verifiable: you can require a passing score before someone works the floor or the bar, and managers get pulled in exactly when someone's struggling instead of finding out too late." },
  { name: "Your Role guide (what staff see)", what: "Every team member has a \"Your role\" page on their dashboard — a clean, read-only guide to what's expected of them: an AI-written role overview at the top, then the guest-experience standard they're held to and the responsibilities they own, all pulled live from what the owner set in Training & Standards (so it's never maintained twice). Managers and owners preview any role's guide from Training → \"Preview role guide,\" flip between every role, and write each overview with one-tap \"Generate with AI\" grounded in that role's own standards and duties.", problem: "Staff rarely have a clear, always-available answer to 'what exactly is expected of me in this role?' — it lives in a handbook nobody reads or in a manager's head. This puts each person's standard one tap away before every shift, in plain language, and keeps it perfectly in sync with the training the owner already built." },
  { name: "Ask Wingman (staff knowledge assistant)", what: "The in-app assistant (bottom-right of every screen) now answers two kinds of questions: how to use the app, AND how THIS restaurant runs — pulled live from the owner's own content: each role's standards and duties, the role overview, the full menu (ingredients, allergens, pairings), and the owner-authored Team Playbook (their own SOPs and policies). A line cook can ask 'does the ribeye have nuts?' or a new server 'what's expected of me?' and get an instant, sourced answer ('from your Server standards') without stopping to find a manager. It's role-scoped (staff see only their role's content + shared info), grounded strictly in the restaurant's own content, and refuses to guess a policy/allergen it doesn't have — it says 'not documented yet, ask your manager.' No SMS, no extra cost — it runs in-app on the plan. And when it can't answer, the staffer taps 'Ask a manager': the question is routed to the location's managers/owners (push + email), they answer in a Questions inbox, the staffer is notified back, and the answer saves into the Team Playbook so the assistant handles it automatically next time — every manager interruption becomes a permanent answer, so the system gets smarter with use.", problem: "The #1 controllable driver of restaurant turnover is the manager relationship, and new hires quit most in the first 90 days — a huge part of which is the constant 'go ask someone' friction. This gives every staffer an always-available answer to 'how do we do it here,' cuts manager interruptions mid-shift, and makes the owner's documented standards actually get used. Competitively it matches what horizontal tools like Trainual charge $250-400/mo for (an AI that answers from your SOPs) — except Wingman already has the content structured and ties it to guest retention, so it's one more reason the restaurant's whole operating brain lives in Wingman and never leaves." },
  { name: "Accountability", what: "Spot-checks, daily and pre-shift checklists, automatic coaching flags, a FOH loyalty checklist that makes Servers/Bartenders ask every guest about the loyalty program, sign up non-members, add missing numbers, and check points/rewards, and a Server standards checklist — a 20-point pre-shift acknowledgment of the hospitality standard (mindset, first impressions, the 3-touch model, the 5-star finish) each server checks off before the floor. All completed per shift with a manager report of who's actually doing it (FOH-facing, editable/AI-buildable like the other checklists — an owner can even upload their own existing server checklist to start from).", problem: "Standards slip the moment the owner isn't watching; this inspects what they expect, every shift. The loyalty checklist plugs the biggest leak in most loyalty programs — the floor never asks — so more members get captured, which feeds directly into who Bounce Back can win back later. The server checklist makes the hospitality standard a thing servers acknowledge, not something the owner hopes they picked up. And owners can build their OWN role checklists (with AI, or by uploading what they already use), assign each to one or more roles, and every staffer in those roles gets it to complete when they log in — so Bartenders, Line Cooks, Hosts, whoever, each run their own standard every shift, with a manager completion report per checklist." },
  { name: "Service Recovery", what: "Tracks comps and how guest issues were made right.", problem: "A bad moment quietly loses a guest forever; this makes recovery a habit, not an accident." },
  { name: "Hiring, Growth & Menu", what: "Interview criteria that screen for the person, plus a ready-made online application form (shareable link or embed on their own site, no website or subdomain needed, pre-fillable by role/location) that the owner can fully customize — turn built-in fields on/off, rename and require them, and add their own custom questions (short text, paragraph, dropdown, yes/no, number), with answers shown right on each applicant's card. NEW — AI pre-interview SCREENING: per role, Wingman drafts a few short questions (3 guest-experience scenarios + 1 that quietly tests whether they follow directions) grounded in that role's hiring criteria, owner-editable, shown on the form once the candidate picks the role. When someone applies, Wingman grades their written answers and drops a read on the applicant's card — a Strong fit / Worth a look / Probably pass tier plus a 1–5 score for guest-experience instinct and for following instructions, each with a one-line reason — so the operator decides who's worth an interview BEFORE spending a slot. It's decision support (never auto-rejects, never changes status; the manager always decides) and the candidate-facing form just says 'we review every application and reach out if we'd like to interview' — no mention of AI. This all feeds an Applicants pipeline that flows in one direction: Applications (status new/contacted/not a fit, optional resume) → schedule + confirm an interview (date, time, details) → the person moves into the candidates area under 'Interviews scheduled' → score them after the interview → candidate. Any location with an interview booked that day gets a morning reminder email at its address on file. Plus revenue and menu-engineering tools — Menu Engineering plots each dish as a Star/Plowhorse/Puzzle/Dog by profit and popularity, and a whole menu can be brought in at once via CSV import with mappable columns (leave any field blank and fill it in later by editing the item). NEW — Job openings: post a specific role at a location (or all locations), let AI write the full job ad grounded in that role's own standards, duties, and hiring criteria (or paste an existing ad to sharpen), and get a short branded link (joinwingman.app/j/…) plus a QR code to post on Indeed/Craigslist/social or print on a window sign — applicants land pre-set to the role and location and are tagged to that opening, and Wingman counts clicks vs applications per posting (e.g. 120 clicks → 9 applied) so the operator sees which board actually works — analytics a plain TinyURL can't give; close/reopen/delete anytime, applicants are always kept.", problem: "Rounds out the system — they collect applications without paying for a careers page or a job board, every applicant lands in one tracked pipeline instead of a messy inbox, interviews get scheduled and never forgotten (daily reminder), and better people flow straight into the scorecard. Great for the owner drowning in DMs and texts from applicants." },
  { name: "Partners (B2B / Community)", what: "A lightweight relationship CRM for the businesses AROUND the restaurant — offices, schools, gyms, non-profits, the chamber. Managers add contacts (or snap a business card and AI reads it into the form), log every touch (call, email, meeting, booked event/fundraiser with the real revenue it brought in), and Wingman flags any connection gone 30+ days quiet with a 'Needs Follow-up' badge and a default 'Needs Follow-up First' sort. Owners set quarterly goals per store (new contacts, events, fundraisers, connections kept warm), and on the 1st of each month Wingman emails a leadership rollup across all stores plus each manager their own store's metrics and a 'hit list' of who to call this week. Managers see only their assigned store(s); owners see everything. Follow-up tasks scheduled while logging an activity email the manager on the due date.", problem: "Catering, group lunches, private events, happy hours, and fundraisers are massive revenue most restaurants leave on the table because nobody systematically works the neighborhood — relationships start warm and quietly go cold. This turns community outreach from random luck into a measured habit: the team always knows who's fading and who to call, leadership sees which stores are actually building relationships, and every booked event's real dollars are tracked. It's Bounce Back's win-back discipline pointed at local businesses instead of guests." },
  { name: "Reporting", what: "Rolls every section into one view, shows repeat rate by cohort over the last 6 months and week-over-week money trends, a retention-ROI card that puts real dollars on the regulars they've won back vs. the money still on the table, and can email a scheduled digest to the owner or an investor.", problem: "Operators fly blind on whether things are actually improving — this turns the whole system into a trend they (and their investors) can watch, and translates guest work into the dollar language owners actually decide on." },
  { name: "14-Day Launch Plan", what: "A dated rollout on the Start Here page: a few moves every few days across four phases, each milestone checking itself off as they do the work, with an on-track / overdue status and a short weekly accountability email nudging their next move.", problem: "Answers the objection every operator has — 'we bought software before and never used it.' This makes implementation fast and accountable, so they actually run it and get a return instead of it gathering dust." },
  { name: "Momentum score", what: "A usage score on the dashboard, separate from Business Health: five weekly habits, a streak, and the single next move when they drift — plus a friendly email nudge if a week goes quiet.", problem: "Extends the launch accountability past week two. It keeps the habits alive long-term (and catches a stalling account early), which is what actually protects their results — and their subscription." },
  { name: "Weekly 3 moves", what: "A dashboard commitment card where the owner picks up to three concrete moves for the week and ticks them off as they go.", problem: "Turns good intentions into a finite, checkable commitment. Three things you'll actually do beats a bottomless to-do list — it's the simplest habit that keeps an operator moving week to week." },
  { name: "Notification controls", what: "A Notifications section in Settings — open to managers and owners, not just the owner — where the account switches Wingman's automatic emails on or off: new job applications, interview-day reminders, test-overdue and test-locked manager alerts, and the before-deadline reminders to staff. Each toggle names exactly who receives that email; changes save instantly and apply account-wide. Scheduled reports and billing emails always send.", problem: "Operators worry software will spam them or their team. Giving them a clear, in-plain-English switchboard over every automatic email — without hiding it behind owner-only access — kills the 'too many notifications' objection and lets each account tune Wingman to how they actually run." },
  { name: "Your language (English / Spanish)", what: "Every person picks their own language on first login (default English) and can switch anytime from a top-bar toggle. The choice is per user, so a Spanish-speaking cook does their training and tests in Spanish while the owner stays in English. It's not just buttons: Wingman AI-translates the owner's own test questions and answers into the staffer's language (cached after the first time), so the actual training content lands — starting with the test-taking experience, expanding to checklists and training next.", problem: "Half the back-of-house often reads English as a second language, so training and tests don't actually land. Letting each person work in their own language removes the excuse and makes standards real for the whole team — a differentiator most restaurant software ignores." },
  { name: "Doc → test (AI document import)", what: "Upload an existing SOP, ops manual, or menu — PDF or text — and Wingman reads it and builds a full training + auto-scored quiz straight from its contents (owner reviews and approves before it saves). PDFs are read natively; text can be pasted too.", problem: "Operators already have their standards written down somewhere — a binder, a PDF, a Google Doc. This turns that dead document into live, testable training in one step, removing the single biggest reason training software never gets used: nobody has time to re-type their manual into it." },
  { name: "Training leaderboard", what: "A per-location leaderboard that ranks the team on training points — passing tests, scoring well, and signing off training — with milestone badges (Certified, Perfect score, On a roll). Staff see the board and their rank; the owner can turn it on or off for the floor with one switch. It's built entirely from data the account already has, so it just turns on.", problem: "Getting a team to actually finish training is the hard part. A little visible, friendly competition turns 'you have to' into 'I want to move up the board,' which lifts completion and scores without a manager nagging. It's the engagement layer that makes the rest of the training stick." },
  { name: "Learning paths (new-hire onboarding)", what: "Bundle existing tests, role training, and simple tasks (shadow a shift, read the SOP) into one ordered, step-by-step path a manager assigns to a new hire. The new hire sees their path when they log in, works through it, and checks each step off; managers see a live percent-complete per person.", problem: "Onboarding a new hire is the messiest, most inconsistent moment in a restaurant — everyone does it differently and things get skipped. A learning path makes 'here's exactly what your first two weeks look like' a single assignable checklist, so every new server or cook gets the same start, and the manager can see at a glance who's on track." },
  { name: "Franchise tier (franchisor oversight)", what: "One level above the single account: a franchisor gets a group console showing every franchisee's compliance and outcomes (repeat rate, audit health, spot-check/sign-off cadence) — compliance and aggregates only, never a franchisee's raw guest contact list, so it's privacy-safe. They push brand-standard training to every franchisee, locked (can't be edited) or adaptable. Billing runs two ways: distributed (each franchisee pays their own card, the franchisor just gets visibility) or central (the franchisor pays one rolled-up monthly charge covering every franchisee). A franchisor is provisioned by us — 'Invite a franchisor' spins up their brand-HQ login with no license purchase — and if they also run corporate-owned stores, their HQ can pay for those per-location just like a franchisee, on top of the franchisee roll-up.", problem: "Multi-unit brands and franchisors have no way to hold every location to one standard or see brand-wide compliance in one place — and they worry about who pays and who sees guest data. Wingman answers all three: one training standard pushed down and locked, one oversight view, and flexible billing that fits how the brand is actually structured." },
];

// Feature reference — NOT selling points, but system details a rep should be
// able to answer when a prospect asks "does it do X?". Put operational /
// feature-FAQ items HERE (not in PRODUCT_TOUR, which is the core value story).
export type SystemNote = { name: string; detail: string };

export const SYSTEM_REFERENCE: SystemNote[] = [
  { name: "Staff View toggle (demo, internal)", detail: "The Staff View is the real, tailored experience a team member gets when they log in as Staff — a personal home (their training progress, the tests assigned to them, this week's focus/experiment, links to their pre-shift checklist and training — no restaurant-wide KPIs), a Training page scoped to only their role(s), their own tests/scores, and their own sign-off log (no leaderboard, no one else's results), a personal Accountability checklist, and a flattened sidebar with the owner-only sections (Reporting, Growth, Hiring, Settings, Service Recovery) hidden. Managers keep the full view but also get a personal 'your tests to take' section since they take tests too. In the demo, a bar at the top lets the rep flip between the owner view and this Staff View — one click, mid-call — so it's demo-previewable but NOT demo-only: it's exactly what every real staff login sees. The toggle changes only which view is shown, never the data. Use it to answer the common 'what will my staff actually use?' objection by SHOWING the focused staff experience instead of describing it." },
  { name: "Menu items (one shared menu, FOH + kitchen)", detail: "There's ONE food menu and ONE bar menu — not a separate menu siloed per role. Each dish/drink carries description, allergens, a pairing, and an upsell. The key story: a dish is SHARED — the server needs to know it (what's in it, allergens, how to sell it) and the kitchen needs that same dish PLUS how to make it; the bar works the same way for bartenders. So the recipe is just the maker's extra layer on a shared item, not a second menu. The owner uploads a photo or PDF and Wingman's AI reads every item and fills all of that in, including a category (it uses the menu's own sections when present and infers one when not). Items display grouped by category (Appetizers, Salads, Mains, Cocktails…) in collapsible sections, so a 50-item menu is easy to scan on a phone mid-shift — the same grouped view staff see. LIMITED TIME OFFERS: flag a dish as an LTO (checkbox, or bulk 'Mark as LTO') and it jumps to its own pinned 'Limited Time Offers' section at the top; clear the flag and it drops back to its category — built for the monthly-special rotation every operator runs. Managing it is easy: edit inline (pencil), multi-select to bulk-archive or bulk-LTO, and re-upload anytime — Wingman matches by name across the shared menu and updates in place (keeping popularity/profit numbers) instead of duplicating. Demo the upload-and-auto-fill as the 'we did the data entry for you' moment; flip to Server vs Chef view to show the SAME dish with the recipe appearing only for the kitchen." },
  { name: "Recipes (how to make each dish AND drink)", detail: "Every dish and drink can carry a Recipe — a numbered, step-by-step 'how to make it' with a real photo on each step (snapped or uploaded from a phone or computer). It's the MAKER's layer on a shared menu item: the kitchen (Chef role) pulls up food recipes on the line, the Bartender pulls up cocktail recipes at the well — so every plate and every pour goes out to spec. Managers/owners build and edit; it hangs off the menu item, so a recipe never gets lost: archiving or 'deleting' a dish keeps its recipe and restores with it. Photos are auto-shrunk in the browser before upload, so it doesn't balloon storage. And one tap turns a recipe into a test: 'Turn into a test' writes a learn-then-quiz from the steps (sequence, temps/times, plating), lands it in the prebuilt tests ready to assign, and keeps one test per dish. For a kitchen- or bar-heavy operator, this is the consistency pitch — 'the same plate and the same cocktail, every maker, every shift, and a test to prove they know it.' In the demo, flip to Chef view for the food recipes and Bartender view for the cocktail recipes." },
  { name: "Data safety & recovery", detail: "Deleting a guest, partner, or staff member is a soft delete — it moves to an owner-only Trash (Settings → Trash) where it can be restored exactly as it was, or removed for good. A recent-activity audit log records every delete, restore, and permanent removal with who did it and when. The whole account is also backed up at the database level as a separate catastrophe net. A manager can delete (it's logged), but only the account owner can see or empty the Trash." },
  { name: "Direct POS integrations", detail: "Square connects in one click from Settings → API access → Direct integrations (no API key or Zapier). It auto-syncs customers into Guest Bounce Back (deduped by email/phone) and the last 7 days of sales into the weekly Business Health card, matched per location by store name for multi-unit operators — daily, or on-demand with 'Sync now'. Only the account owner can connect/disconnect. Clover connects the same one-click way (each Clover store is its own merchant, so multi-unit operators connect each store). Toast and Lightspeed connectors are built too — Toast links by Restaurant GUID (after enabling Wingman in Toast), Lightspeed connects via one-click OAuth. Each shows 'Onboarding in progress' until its partner credentials go live; Global Payments (Genius POS), Toast, and Lightspeed are in partner onboarding now. The integrations list is alphabetical: Clover, Global Payments, Lightspeed, Square, Toast. A code/Zapier API path also exists for any other POS." },
  { name: "Billing & payments", detail: "Card payments run on Global Payments. The owner adds a card under Settings → Billing; card details go straight to the processor and are never stored on Wingman's servers. The subscription then charges automatically each month, emails a receipt, and — if a charge fails — drops to past-due and starts a 30-day dunning sequence before suspension. Charges show on the statement as 'The Maverick Agency.'" },
  { name: "Price lock (grandfathering)", detail: "A customer's price is locked to what they signed up at. If we raise (or lower) list pricing later, it only affects NEW signups — existing customers are never re-priced. Useful to reassure an early customer that signing now protects their rate, and to answer 'what if your price goes up?' — it won't, for them." },
  { name: "Scheduling & demo booking (internal)", detail: "Each rep connects Google Calendar and/or Outlook (Microsoft 365) under Admin → Calendar (up to two of each, free/busy merged across all of them so you're never double-booked), sets weekly availability + time zone (any IANA zone worldwide), and gets a personal booking link (joinwingman.app/book/<you>). Each rep picks their video provider — Auto, Google Meet, or Zoom (connect Zoom under Admin → Calendar). Google Meet requires a Google-hosted event (a Google limitation); Zoom works with any calendar, so Outlook reps use Zoom. Prospects pick a day on a month calendar, then a time, in their own (auto-detected, adjustable) time zone. Prospects self-book an open time; Wingman creates the meeting on your calendar with a Google Meet link and emails a confirmation with a calendar (.ics) invite. The public /book-a-demo page runs as a round-robin POOL: add your calendar to it (Admin → Calendar) and demos are offered whenever ANY pooled rep is free, then assigned to a free rep least-loaded-first. Guests get a pre-appointment reminder series (day-before + starting-soon) with the Meet link and a reschedule/cancel link; cancelling frees the slot, removes the Google event, and emails a one-tap rebook link. Platform-admin only — clients never see this. Zoom + Outlook are on the roadmap; Google Meet ships now." },
];

// Full franchise-plan reference — every function + option, for demoing the tier
// to a multi-unit brand or franchisor. Rendered as its own card in Sales Training.
export type FranchiseFeature = { title: string; detail: string };
export type FranchiseTopic = { heading: string; items: FranchiseFeature[] };

export const FRANCHISE_PLAYBOOK: { summary: string; whoFor: string; topics: FranchiseTopic[]; talkTrack: string[] } = {
  summary:
    "Wingman's franchise tier adds one level above a normal account: a franchise GROUP that links each franchisee's own account under a franchisor. The franchisor sets one brand standard, sees brand-wide compliance, and chooses how billing works — while every franchisee keeps a full, standalone account (their own team, guests, and control).",
  whoFor:
    "Franchisors and multi-unit brands who want every location on the same training/hiring/standards, one oversight view, and flexible billing. Also fits a corporate group that owns several stores and wants HQ-level rollup.",
  topics: [
    {
      heading: "Getting started (who sets up what)",
      items: [
        { title: "Franchisor is provisioned by us", detail: "A platform admin creates the group and uses 'Invite a franchisor' — spins up the franchisor's brand-HQ login with NO license purchase (normal signup requires buying one). They become the group's billing owner + admin. No contact fields to fill: their name/email come from the invite." },
        { title: "Franchisor invites their own franchisees (self-service)", detail: "From the franchisor's console, 'Add a franchisee' takes a name + email → the franchisee gets a set-password email and a full account, pre-loaded with the starter playbook, auto-joined to the group with the group's billing mode. The franchisor doesn't wait on us for each location." },
        { title: "Franchisees add their own team", detail: "Each franchisee owner invites their own managers, shift leads, and staff exactly like any Wingman customer (Settings → Team). Their staff never see other franchisees." },
      ],
    },
    {
      heading: "Oversight (what the franchisor sees)",
      items: [
        { title: "Group console + rollup", detail: "A franchisor-only console shows brand-wide averages (repeat rate, audit health, spot-check/sign-off cadence) plus a per-franchisee hit list, worst-first, so they coach the locations that are slipping." },
        { title: "Privacy-safe by design", detail: "The franchisor sees compliance and aggregates ONLY — never a franchisee's raw guest contact list. Guest PII stays with the franchisee that owns it (compliance-friendly). Lead with this when a brand asks about data." },
      ],
    },
    {
      heading: "Brand standards (push down & lock)",
      items: [
        { title: "Brand Library", detail: "The franchisor authors training in their own account, then pushes it to every franchisee from Franchise → Brand Library. Because a test lives at the account level, it applies to all of that franchisee's locations." },
        { title: "Locked vs Adaptable", detail: "Locked = a brand standard the franchisee can use but can't edit (enforced at the database, not just the UI). Adaptable = a starting point they can localize. Locked content shows a 'Brand standard' badge; re-pushing publishes updates to everyone." },
      ],
    },
    {
      heading: "Billing options",
      items: [
        { title: "Distributed", detail: "Each franchisee pays their own card; the franchisor just gets visibility. Default, no extra setup." },
        { title: "Central", detail: "The franchisor pays for all — franchisees aren't charged individually, and one rolled-up monthly charge (the sum of every franchisee's price) hits the franchisor's card. Franchisees see a 'Billed by your franchise group' note." },
        { title: "Corporate-owned locations", detail: "A franchisor who also runs their own corporate stores can pay for those per-location, just like a franchisee, ON TOP of the franchisee roll-up — same card, separate line items." },
        { title: "Price lock still applies", detail: "Every franchisee's price is grandfathered to what they signed up at, same as any customer." },
      ],
    },
    {
      heading: "Lifecycle & safety",
      items: [
        { title: "Archive (soft-cancel)", detail: "If a franchise cancels, the group can be Archived — history and relationships are kept, billing pauses, and it's restorable anytime. Nothing is lost." },
        { title: "Delete is safe", detail: "Permanent delete never removes a franchisee's account — it only detaches them (they bill for themselves again and keep editable copies of any pushed content), then removes the group." },
      ],
    },
  ],
  talkTrack: [
    "Open on the pain: \"How do you know every location is actually running your standard — not just the ones you visit?\"",
    "Show the group console rollup + hit list: one screen, every location's compliance, worst-first.",
    "Push a brand-standard training live in the demo and point out it's locked — same training, every location, can't be watered down.",
    "Handle the data question proactively: the franchisor sees compliance, never a franchisee's guest list.",
    "Close on billing fit: \"Do you want each owner to pay, or do you cover it centrally?\" — Wingman does either, and you can switch.",
  ],
};

export const GOLDEN_RULES: string[] = [
  "You're a guide, not a closer. Your job is to help the operator see their own problem clearly — Wingman is just how they solve it.",
  "These are loose scripts. Never read them word-for-word. Use your own voice; the words below are only there to keep you pointed the right way.",
  "The operator should be talking more than you. If you're doing most of the talking, stop and ask a question.",
  "Lead with their problem, not our features. Show only the parts of Wingman that touch what they told you hurts.",
  "Never be salesy. No fake urgency, no pressure, no overpromising. If it's not a fit, say so — trust earns the next referral.",
];

// Rapport first — the demo only works if it feels like two restaurant people
// talking, not a pitch.
export const RAPPORT: string[] = [
  "Open like a human, not a rep. A little genuine small talk — their concept, how long they've been open, what they're proud of — earns you the right to ask the harder questions later.",
  "Match their energy and pace. Fast and casual? Be fast and casual. Measured and quiet? Slow down. People trust people who feel like them.",
  "Find the real thread. Most operators light up about one thing — a signature dish, a regular, why they opened the place. Follow it. That thread is where trust, and the truth about their problems, lives.",
  "Slow down and lower your voice. A calm, unhurried tone signals you're not here to pressure them — which is exactly what makes them open up.",
  "Use their name naturally, not as a sales tic.",
  "You're having a conversation, not running a script. The moment it stops feeling like a chat, stop and get it back there.",
];

// Conversation & tactical-empathy techniques adapted from Chris Voss's
// negotiation method ("Never Split the Difference"). Paraphrased in our own words
// with restaurant-demo examples — the point is a genuine, trust-first
// conversation, never manipulation.
export type VossTactic = { name: string; what: string; example: string };

export const VOSS_TACTICS: VossTactic[] = [
  {
    name: "Label what you hear",
    what: "Name the emotion or situation out loud so they feel understood — \"It sounds like…\", \"It seems like…\", \"Looks like…\". A good label gets them to elaborate instead of getting defensive.",
    example: "\"It sounds like the part that really wears on you is training a new server every few weeks and just hoping it sticks.\"",
  },
  {
    name: "Mirror to keep them talking",
    what: "Repeat their last few words back as a gentle question. It costs nothing and gets them to keep going — the second half is usually the real story.",
    example: "Them: \"…and honestly the follow-up just never happens.\" You: \"The follow-up never happens?\"",
  },
  {
    name: "Ask calibrated \"How\" and \"What\" questions",
    what: "Open questions that start with How or What hand them the wheel and get them solving the problem out loud. Skip \"why\" (feels like an accusation) and yes/no questions.",
    example: "\"What would have to be true for your team to actually run this every shift?\" / \"How are you catching first-timers today?\"",
  },
  {
    name: "Aim for \"that's right,\" not \"you're right\"",
    what: "Summarize their world back so accurately they say \"that's right\" — the moment they feel truly understood. (\"You're right\" usually just means they want you to stop talking.)",
    example: "\"So — great food, solid regulars, but nothing's catching the first-timers before they vanish, and no time to build a system for it.\" → \"That's right.\"",
  },
  {
    name: "Run an accusation audit",
    what: "Say the negative thing they're privately thinking before they do. Naming it out loud defuses it and builds trust.",
    example: "\"You're probably thinking this is just one more app your team won't use — honestly, that'd be my worry too. Let me show you why it's different.\"",
  },
  {
    name: "Use \"no\"-oriented questions",
    what: "People feel safe and in control when they can say no. Frame it so a \"no\" still moves you forward — far less pressure than chasing a \"yes.\"",
    example: "\"Would it be crazy to set up your first location so you can see it with your own guests?\" / \"Are you against getting your managers some time back?\"",
  },
  {
    name: "Let silence do the work",
    what: "After you label or ask, stop talking. The quiet pulls the truth out. Don't rescue the moment — count to five.",
    example: "Ask \"What's the one thing that, if it got better, would change your month?\" — then say nothing until they answer.",
  },
];

export type PrepItem = { label: string; detail: string };

export const PREP: PrepItem[] = [
  { label: "Look them up first", detail: "Concept, number of locations, a glance at their recent reviews and website. Two minutes of homework makes the whole call land." },
  { label: "Have one hypothesis", detail: "Based on what you saw, guess their biggest retention gap (e.g. \"great food, but no reason for first-timers to come back\"). You'll test it, not assert it." },
  { label: "Know roughly what they'd pay", detail: "Standard pricing is {{firstPrice}}/mo for the first location + {{addlPrice}}/mo per additional location. Don't lead with price — but never be caught off guard by it." },
  { label: "Have the demo ready", detail: "Hit \"Run a live demo\" (top of your Sales Dashboard or Sales Training), then name who it's for — pick the lead or add a new prospect. That ties them to you as the lead owner and moves them to Demo Completed automatically, so the demo is also your CRM entry. You drop into a fresh, fully-loaded demo account (private to you, resets clean each time). Use \"Exit\" in the banner to return when you're done." },
];

export type Movement = {
  n: number;
  title: string;
  minutes: string;
  intent: string;
  script: string[];
  doThis: string[];
  dont: string[];
};

export const MOVEMENTS: Movement[] = [
  {
    n: 1,
    title: "Open & set the frame",
    minutes: "~2 min",
    intent: "Turn it from a pitch into a conversation, and get permission to ask questions before you show anything.",
    script: [
      "\"Thanks for making time. Before I show you anything, I'd love to just hear about your place — what's working, what's driving you a little crazy. Then I'll only show you the parts of Wingman that actually matter to you. Sound good?\"",
      "\"Fair warning: I'm not here to hard-sell you. If this isn't a fit, I'll tell you. Deal?\"",
      "\"You've probably sat through a demo where someone talked at you for 30 minutes straight — I'm not going to do that. Tell me to stop anytime.\"",
    ],
    doThis: [
      "Set the expectation that you'll ask before you show.",
      "Open with a light accusation audit — name the bad-demo fear out loud and disarm it before you start.",
      "Make it clear early that a \"no\" is a fine outcome — it relaxes them and they'll tell you the truth.",
    ],
    dont: [
      "Don't open by screen-sharing and touring the app.",
      "Don't launch into the company story. They don't care yet.",
    ],
  },
  {
    n: 2,
    title: "Discover — where do they see issues?",
    minutes: "~10 min · the heart of the demo",
    intent: "Find the one problem that actually keeps them up at night, in their own words. Everything after this hangs on what you learn here.",
    script: [
      "\"Of the guests who walked in this month, how many do you think you'll actually see again?\"",
      "\"When a new server starts, how do they learn the way you want things done — or do they kind of pick it up?\"",
      "\"If one thing about the business got better tomorrow, what would you want it to be?\"",
    ],
    doThis: [
      "Ask, then go quiet. Let the silence do the work — they'll fill it with gold.",
      "Label what you hear back to them — \"It sounds like the follow-up is the piece that really slips.\" A label gets them to open up; a question can make them defend.",
      "Keep every question open — \"How\" and \"What,\" never \"why\" (it sounds like an accusation). You're handing them the wheel.",
      "Follow the thread they get animated about. That's the real problem.",
      "Write down the exact words they use. You'll mirror them back later.",
    ],
    dont: [
      "Don't interrupt to say \"oh, Wingman does that!\" — note it, keep listening.",
      "Don't run down a checklist of questions robotically. It's a conversation.",
    ],
  },
  {
    n: 3,
    title: "Show what solves their issue",
    minutes: "~10 min",
    intent: "Show the one or two parts of Wingman that touch what they just told you — nothing else. A short, relevant demo beats the full tour every time.",
    script: [
      "\"You said the hard part is first-timers never coming back — let me show you exactly how we'd catch that.\" (Then show Guest Bounce Back.)",
      "\"Remember what you said about new servers picking it up on their own? Here's how your standard becomes something they're actually trained and checked against.\" (Then show Training / Accountability.)",
      "\"And here's how you prove they learned it, not just sat through it.\" — on the Training page, hit the big Start a test button: pick 'all staff,' check off the Food Test, send. Then open \"Assigned to you\" and take a question or two so they see the exact staff experience. Point out the results board (who passed, who's locked) and that a lock or a missed deadline emails the manager automatically. (The demo account is pre-loaded with all of this.)",
      "\"And it all rolls up under each person.\" — open anyone from Staff to show the Activity view: training %, tests passed, checklist completion, and their hiring score, all in one place. Great for the owner who asks \"how do I know where each person stands?\"",
      "\"Want to see what your servers actually see? One click.\" — hit \"View as staff\" in the top bar. The nav shrinks and the whole app becomes the staff experience: a personal home (their training, their assigned tests, this week's focus), their pre-shift checklist, and a Training page scoped to just their role and their own scores — no restaurant numbers, no one else's results. Flip \"Back to owner view\" just as fast. This is the single best answer to \"will my team actually use it?\" — you SHOW the focused staff view instead of describing it. (Demo-only toggle; it's exactly what a real staff login sees.)",
      "\"And here's why they'll actually open it.\" — still in staff view, open the Ask Wingman assistant (bottom-right) and type a real question like \"does the [dish] have any allergens?\" or \"what's expected of me as a server?\" It answers instantly from THIS restaurant's own menu/standards and cites the source — no manager needed. Then hit \"Ask a manager\" to show the escalation: the question routes to managers (push + email), they answer in the Questions inbox, and it saves into the Team Playbook so the assistant knows it next time. Land the line: \"Every question your team asks makes this smarter — the tools that only store SOPs charge $250-400 a month for just this, and it can't bring a guest back.\"",
    ],
    doThis: [
      "Before you show anything, play their problem back until they say \"that's right.\" That's your green light — once you've got it, the demo lands. If you don't, keep listening.",
      "Mirror their words as you click: \"this is that first-timer problem you mentioned.\"",
      "For an owner who's been burned by staff not retaining training, the test flow is the money shot: build it → assign it → take it as a staffer → who-passed board. Show it end to end.",
      "When they ask \"what will my team actually deal with?\", flip \"View as staff\" and let them look. The stripped-down, personal staff view answers the objection better than any pitch.",
      "Tie every screen back to a dollar or an hour saved, in their world.",
      "Stop and ask \"is that the kind of thing you meant?\" — keep them in it.",
    ],
    dont: [
      "Don't tour features they never asked about. A firehose kills the deal.",
      "Don't demo in the abstract — always anchor it to their specific problem.",
    ],
  },
  {
    n: 4,
    title: "Surface the hesitations",
    minutes: "~5 min",
    intent: "Draw out what's really in the way — before they go quiet and 'think about it.' You can only address what they'll say out loud.",
    script: [
      "\"Be straight with me — what's the part of this you're not sure about?\"",
      "\"If you didn't move forward, what would be the reason?\"",
      "\"It seems like the real question is whether your team will actually use it — am I close?\"",
    ],
    doThis: [
      "Treat every hesitation as useful information, not a fight to win.",
      "Label the hesitation instead of arguing it. Naming it (\"it seems like timing's the sticking point\") lets them confirm it and say more, instead of digging in.",
      "Reframe, don't rebut (see the reframes section).",
      "It's fine to say \"that's a fair concern\" and sit with it.",
    ],
    dont: [
      "Don't get defensive or talk over the objection.",
      "Don't invent urgency (\"this price ends Friday\") — it reads as a trick.",
    ],
  },
  {
    n: 5,
    title: "One clear next step",
    minutes: "~2 min",
    intent: "End with a single, obvious next action — not a hard close. Make it easy to say yes to something small.",
    script: [
      "\"Here's what I'd suggest: let's get your first location set up so you can see it with your own guests. No pressure — if it's not helping in a couple weeks, walk away.\"",
      "\"Would it be crazy to get your first location set up so you can watch it work with your own guests?\"",
      "\"How about I follow up Thursday after you've had a chance to sit with it? I'll put it on both our calendars now.\"",
    ],
    doThis: [
      "Offer exactly one next step, with a date attached.",
      "Make the next step small and reversible — a trial, a follow-up, a setup call.",
    ],
    dont: [
      "Don't stack three asks. Confusion kills momentum.",
      "Don't push for a signature on the spot if they're not there. The follow-up is the win.",
    ],
  },
];

// After-the-call pipeline hygiene. Some of this is automatic; the rest is on
// the rep. An honest pipeline is the only one worth reporting on.
export type ProcessStep = { title: string; detail: string };

export const PIPELINE_PROCESS: ProcessStep[] = [
  {
    title: "Assign yourself to the lead",
    detail: "Set the \"Sales rep\" on every contact you're working (on the contact in CRM). That's what makes it show up in your Sales Dashboard — leads, demos, won, lost — and keeps your numbers yours. Shortcut: when you name the prospect on \"Run a live demo,\" they're assigned to you and moved to Demo Completed automatically — no manual step.",
  },
  {
    title: "After the call, move the stage to the truth",
    detail: "Running the demo already moved them to Demo Completed. If the call changes that — they're interested but not ready (Nurturing), or it's a no (Lost / Dormant) — update the stage to what's actually true now, while it's fresh. A pipeline you can trust is the whole point.",
  },
  {
    title: "You never move \"Won\" by hand",
    detail: "When a prospect actually pays, Wingman moves their contact to Signed Up automatically. So \"Won\" on your dashboard means real, paying customers — not hopeful ones. Don't pre-celebrate by dragging cards.",
  },
  {
    title: "Cancellations become Past Clients — don't write them off",
    detail: "If a customer ever cancels, their contact moves to Past Clients automatically and a gentle Reactivation sequence starts (one value-first email a month). That's your warm list. A quick personal note from you often reopens the door faster than the automation.",
  },
];

export type QuestionGroup = { theme: string; questions: string[] };

export const QUESTION_BANK: QuestionGroup[] = [
  {
    theme: "Retention & repeat guests",
    questions: [
      "How do you know if a first-timer ever comes back?",
      "What do you do today to bring guests back — anything, or is it word of mouth?",
      "What's a regular worth to you over a year? (Let them do the math out loud.)",
    ],
  },
  {
    theme: "Consistency & training",
    questions: [
      "When you're not there, does the guest get the same experience?",
      "How does a new hire learn your standard right now?",
      "What breaks first on a busy night?",
    ],
  },
  {
    theme: "Reputation & reviews",
    questions: [
      "How do you handle it when something goes wrong for a guest at the table?",
      "Where do your reviews come from — do you ask, or just hope?",
    ],
  },
  {
    theme: "Cut to the core",
    questions: [
      "What's the one thing that, if it got better, would change your month?",
      "What have you already tried to fix this, and why didn't it stick?",
    ],
  },
];

export type Reframe = { objection: string; reframe: string };

export const REFRAMES: Reframe[] = [
  {
    objection: "\"I don't have time to set this up.\"",
    reframe: "Agree — that's exactly why it exists. \"You won't build it from scratch; it drafts your standards and training for you, and we set up the first location together. The point is to give you time back, not take more.\"",
  },
  {
    objection: "\"We already use a POS / loyalty app.\"",
    reframe: "\"Perfect — this isn't a POS. It's the layer that turns a first visit into a regular and keeps your team to one standard. It sits alongside what you've got; it doesn't replace it.\"",
  },
  {
    objection: "\"My team won't use another tool.\"",
    reframe: "\"They won't have to live in it — most of it runs behind the scenes for you and your managers. The staff-facing part is a pre-shift checklist, not another app to babysit.\"",
  },
  {
    objection: "\"Money's a little tight right now.\"",
    reframe: "\"I hear you. So let's be honest about the math — if this brings back even a couple of tables a month that would've been one-and-done, it's paid for itself. Let's not decide on price, let's decide on whether it moves that number.\"",
  },
  {
    objection: "\"Let me think about it.\"",
    reframe: "\"Totally fair — what specifically do you want to think through? If it's whether your team will adopt it, or the price, let's talk about that now so you're not chewing on it alone.\"",
  },
  {
    objection: "\"Does it really work for a place like mine?\"",
    reframe: "Don't overpromise. \"Honestly, it depends on whether you'll use it — it's a system, not magic. From what you told me about [their problem], I think it fits. But if you try it and it's not helping, I'd rather you walk than stay.\"",
  },
  {
    objection: "\"New hires take forever to ramp / my managers answer the same questions all shift.\"",
    reframe: "\"That's exactly the friction Ask Wingman kills. Every new hire has an in-app assistant that answers 'what's expected of me,' 'does this dish have nuts,' 'what's our comp policy' — from your own menu, standards, and playbook, no manager needed. When it can't answer, they tap 'ask a manager,' the answer comes back, and it's saved so nobody ever answers that question again. The tools that just document SOPs charge $250-400 a month for that one feature — you get it in the plan, and unlike them it's tied to bringing guests back.\"",
  },
  {
    objection: "\"How is this different from Trainual / a training-doc tool?\"",
    reframe: "\"Those are a searchable binder — great at storing SOPs, blind to your guests, your shifts, and your repeat rate. Wingman documents the standard AND runs it: it trains and tests your team, checks the standard every shift, answers their questions from your own content, and turns first-timers into regulars. Leave a doc tool and you lose a wiki; leave Wingman and you lose your operating brain and the engine bringing guests back.\"",
  },
];

export const NEVER_DO: string[] = [
  "Talk more than the operator does.",
  "Read a script word-for-word instead of having a real conversation.",
  "Pitch features they never asked about.",
  "Invent urgency or scarcity (\"this deal ends tonight\").",
  "Overpromise results you can't guarantee.",
  "Bad-mouth a competitor. Make Wingman stand on its own.",
  "Push for a signature when the honest next step is a follow-up.",
];

export const CLOSE_CHECKLIST: string[] = [
  "Did they name their #1 problem in their own words?",
  "Did they say \"that's right\" when you played their problem back? If not, you haven't nailed the real problem yet.",
  "Did they see how one specific part of Wingman touches that problem?",
  "Did you surface — and actually address — their real hesitation?",
  "Is there one clear next step with a date on the calendar?",
];

// -----------------------------------------------------------------------------
// How reps are paid. Kept here so the plan lives next to the playbook the rep
// reads. The live per-rep ledger (what's owed, what's paid) is separate.
// -----------------------------------------------------------------------------

export type CompComponent = { name: string; amount: string; detail: string };

export const COMP_PLAN: CompComponent[] = [
  {
    name: "Base / draw",
    amount: "Set with the owner",
    detail: "A steady base so you can stay consultative and never feel pushed to force a bad-fit sale. Your exact base is agreed individually.",
  },
  {
    name: "Activation bonus",
    amount: "$125 per location",
    detail: "A one-time bonus for each location activated — paid after the account clears its first paid month, not on signature. Real, paying customers only.",
  },
  {
    name: "Recurring tail",
    amount: "5% of monthly revenue, 6 months",
    detail: "You keep earning a slice of each account you land for its first six months — so it pays to close accounts that actually stick, not just sign.",
  },
];

export const COMP_RULES: string[] = [
  "You're paid on cleared payment — never on a demo, a verbal yes, or a signature alone.",
  "The recurring tail is paid only while you're actively employed here — it ends when your employment ends, for any reason. Activation bonuses that have already vested (the account cleared its first paid month) are still paid out.",
  "Clawback: if an account cancels within 90 days, the activation bonus for that account is reversed.",
  "Affiliate overlap: when an affiliate referred the account, they keep their full commission and you still earn your activation bonus — but the 6-month recurring tail is waived on that one account.",
  "Your current balance — what's owed, what's been paid, and the expected pay date for each line — is always visible to you and the owner in the commission ledger.",
];

// Plain-language context on the affiliate program, so reps understand how a
// referred deal is paid alongside their own commission.
export const AFFILIATE_CONTEXT =
  "Wingman also has an affiliate program: partners who refer a restaurant earn 20% of that account's monthly revenue for its first 12 months. If you close a deal an affiliate referred, you both get paid — they keep their full 20%, you get your activation bonus (tail waived on that account).";
