// -----------------------------------------------------------------------------
// Help Center content.
//
// Everything in the in-app Help section lives here as plain data, so it's easy
// to keep current: when we ship a feature, we add or update its article in the
// same change. Rendering + search live in src/app/(app)/help/*.
//
// To add an article: add an object to ARTICLES with a unique `slug`, a
// `categoryId` that matches a CATEGORY, some `keywords` (help search find it),
// and a `body` built from the block kinds below. To add an image later, drop the
// file in /public and use a { kind: "image", src, alt, caption } block.
// -----------------------------------------------------------------------------

export type HelpBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "tip"; text: string }
  | { kind: "note"; text: string }
  | { kind: "image"; src: string; alt: string; caption?: string }
  | { kind: "diagram"; name: "retention-journey" | "roles" | "pos-sync"; caption?: string };

export type HelpLink = { label: string; href: string; external?: boolean };

// Icon keys map to lucide icons in the Help UI (help-icon.tsx).
export type HelpIcon =
  | "rocket"
  | "layout"
  | "users"
  | "clipboard"
  | "trending"
  | "plug"
  | "settings";

export type HelpCategory = { id: string; title: string; description: string; icon: HelpIcon };

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  categoryId: string;
  keywords: string[];
  body: HelpBlock[];
  links?: HelpLink[];
};

export const CATEGORIES: HelpCategory[] = [
  { id: "getting-started", title: "Getting started", description: "The big picture and how to find your way around.", icon: "rocket" },
  { id: "guests", title: "Guests & retention", description: "Turning first-time guests into regulars.", icon: "trending" },
  { id: "team", title: "Training & hiring", description: "Build role training and screen for great people.", icon: "users" },
  { id: "operations", title: "Daily operations", description: "Checklists, spot-checks, coaching, and audits.", icon: "clipboard" },
  { id: "growth", title: "Growth & menu", description: "Revenue planning and menu engineering.", icon: "layout" },
  { id: "admin", title: "Account & settings", description: "Team, locations, billing, and your login.", icon: "settings" },
  { id: "integrations", title: "Integrations & API", description: "Connect your POS and automations.", icon: "plug" },
];

export const ARTICLES: HelpArticle[] = [
  {
    slug: "ask-wingman-assistant",
    title: "Using the Ask Wingman assistant",
    summary: "The in-app chat that answers how-to questions and reports bugs or ideas for you.",
    categoryId: "getting-started",
    keywords: ["assistant", "chat", "chatbot", "ask wingman", "help bot", "report bug", "suggestion", "feature request", "support"],
    body: [
      { kind: "p", text: "Every screen has an Ask Wingman button in the bottom-right corner. Tap it to open a chat where you can ask how to do anything in the app — it answers from this Help Center and its knowledge of how Wingman works." },
      { kind: "image", src: "/help/ask-wingman.png", alt: "The Ask Wingman assistant panel showing a greeting and tappable suggested questions.", caption: "Open the assistant from the button in the bottom-right of any screen." },
      { kind: "h", text: "What it's great for" },
      { kind: "list", items: [
        "How-to questions — \"How do I log a return visit?\", \"Where do I set up report emails?\"",
        "Understanding a screen or number — what a metric means and where to find it.",
        "Reporting a bug — describe what went wrong and it files it to the Wingman team for you.",
        "Suggesting an idea — ask for a change or new feature and it passes it along.",
      ] },
      { kind: "note", text: "The assistant can't see your live account data (your guests, numbers, or settings), so for account-specific questions it will point you to the exact place in the app to look." },
      { kind: "h", text: "Reporting a bug or idea" },
      { kind: "p", text: "Just tell it what happened or what you'd like. It may ask a quick clarifying question, then confirms it's reported the issue — you'll see a \"Reported to the team\" badge. The Wingman team gets the details and follows up." },
      { kind: "tip", text: "The more specific you are — which screen you were on and what you expected — the faster the team can act on it." },
    ],
  },
  {
    slug: "welcome-to-wingman",
    title: "What Wingman is (and how it's organized)",
    summary: "A quick tour of the whole system and where to find each tool.",
    categoryId: "getting-started",
    keywords: ["overview", "start", "tour", "sections", "navigation", "what is wingman"],
    body: [
      { kind: "p", text: "Wingman is the retention layer for hospitality — it helps you turn every first-time guest into a regular through culture, training, and accountability your team runs every shift." },
      { kind: "h", text: "The main sections, left to right in the sidebar" },
      { kind: "list", items: [
        "Dashboard — your at-a-glance health: repeat rate, retention, what needs attention.",
        "Guest Bounce Back — log guests and their return visits.",
        "Service Recovery — track comps and how issues were made right.",
        "Training & Standards — build role-specific training programs.",
        "Accountability — checklists, spot-checks, and coaching flags.",
        "Hiring — interview criteria that screen for the person, not the resume.",
        "Revenue Growth Planner & Menu Engineering — the numbers side.",
        "Standout Audit — score your operation and find the one thing to fix first.",
        "Reporting, Staff, and Settings — reporting, your roster, and account setup.",
      ] },
      { kind: "tip", text: "What you see depends on your role. Owners see everything; managers see most things; staff see the areas relevant to their shift." },
    ],
    links: [
      { label: "Understanding roles & access", href: "/help/roles-and-access" },
      { label: "Reading your dashboard", href: "/help/reading-your-dashboard" },
    ],
  },
  {
    slug: "roles-and-access",
    title: "Roles & who can see what",
    summary: "The three access levels — Super Admin, Manager, Staff — and what each can do.",
    categoryId: "getting-started",
    keywords: ["roles", "permissions", "access", "super admin", "manager", "staff", "who can see"],
    body: [
      { kind: "p", text: "Every person has one of three access levels, set when they're invited (and editable anytime in Settings)." },
      { kind: "diagram", name: "roles", caption: "Access widens from Staff up to the account owner." },
      { kind: "list", items: [
        "Super Admin — the account owner and co-owners. Full access to everything, including Settings and Billing.",
        "Manager — runs the day-to-day: full access to most sections, no Settings/Billing.",
        "Staff — sees the areas relevant to their shift (e.g. Dashboard, Training, their pre-shift checklist).",
      ] },
      { kind: "note", text: "Owners can fine-tune what Managers and Staff see per section under Settings → Team & permissions." },
    ],
    links: [{ label: "Managing your team", href: "/help/team-and-permissions" }],
  },
  {
    slug: "reading-your-dashboard",
    title: "Reading your dashboard",
    summary: "What each tile means, and how the Business Health card works.",
    categoryId: "getting-started",
    keywords: ["dashboard", "repeat rate", "business health", "retention", "metrics", "needs attention", "locations", "benchmark", "compare locations"],
    body: [
      { kind: "p", text: "The dashboard is your morning glance. The top tiles show your repeat rate, spot-checks logged, sign-offs this week, and culture moments." },
      { kind: "image", src: "/help/dashboard.png", alt: "The Wingman dashboard", caption: "Your dashboard — health at a glance, with the Business Health card at the bottom." },
      { kind: "p", text: "The Guest Retention chart shows how many guests reach each return visit. \"Needs your attention\" surfaces the few things worth acting on today." },
      { kind: "note", text: "Running more than one location? The dashboard ranks each location by repeat rate against your group average, so you can see which rooms are winning guests back and which need a look." },
      { kind: "h", text: "Business Health" },
      { kind: "p", text: "The dark Business Health card (revenue/seat, labor %, avg check, and more) fills in automatically once your POS is connected and pushing weekly numbers. Until then it shows placeholders." },
    ],
    links: [{ label: "Connecting your POS", href: "/help/api-and-integrations" }],
  },
  {
    slug: "culture",
    title: "Culture — your standard, in your words",
    summary: "Set the weekly pre-shift focus and recognize the moments that build your culture.",
    categoryId: "operations",
    keywords: ["culture", "values", "pre-shift focus", "recognition", "culture moments", "weekly focus"],
    body: [
      { kind: "p", text: "Culture is the standard every hire is trained to and every shift is measured against — written in your own words." },
      { kind: "image", src: "/help/culture.png", alt: "The Culture screen", caption: "Culture — your values, weekly pre-shift focus, and recognition." },
      { kind: "list", items: [
        "Set this week's pre-shift focus — it shows on everyone's dashboard as the thing to rally around.",
        "Capture culture moments to recognize people living the standard.",
        "Keep your core values front and center for the whole team.",
      ] },
      { kind: "tip", text: "The weekly focus is the fastest lever you have — change it each week to keep the team pointed at one thing." },
    ],
  },
  {
    slug: "service-recovery",
    title: "Service Recovery — every comp has a reason",
    summary: "Track comps and how issues were made right, so recovery becomes a habit, not a leak.",
    categoryId: "operations",
    keywords: ["service recovery", "comps", "voids", "discounts", "make it right", "complaints"],
    body: [
      { kind: "p", text: "Service Recovery logs every comp with a reason — turning give-aways into a record of how your team makes things right." },
      { kind: "image", src: "/help/service-recovery.png", alt: "The Service Recovery screen", caption: "Service Recovery — every comp, with its reason and category." },
      { kind: "steps", items: [
        "Open Service Recovery.",
        "Log a comp with who, how much, the category, and the reason.",
        "Watch the totals and categories so recovery stays intentional — and coaching flags catch it if comps drift high.",
      ] },
      { kind: "note", text: "Comp totals also feed the Business Health card once your POS is connected." },
    ],
    links: [{ label: "Accountability & coaching flags", href: "/help/accountability-overview" }],
  },
  {
    slug: "guest-bounce-back",
    title: "Guest Bounce Back & retention",
    summary: "Log guests and their visits so you can turn first-timers into regulars — with win-back and referral lists that tell you who to reach out to.",
    categoryId: "guests",
    keywords: ["guests", "bounce back", "retention", "visits", "regulars", "follow up", "win back", "at risk", "lapsed", "referral", "promoter", "reaction", "funnel", "ready to refer"],
    body: [
      { kind: "p", text: "Guest Bounce Back tracks each guest across their first four visits — the window where a first-timer becomes a regular — and turns that into action lists that tell you exactly who to reach out to." },
      { kind: "diagram", name: "retention-journey", caption: "The four-visit window where a first-timer becomes a regular." },
      { kind: "image", src: "/help/guest-bounce-back.png", alt: "The Guest Bounce Back screen", caption: "Guest Bounce Back — track each guest across their return visits." },
      { kind: "steps", items: [
        "Open Guest Bounce Back (or log a first-timer straight from the Guest Journey's arrival stage).",
        "Add a guest (name, and phone/email if you have it).",
        "Log each visit as they return, with the incentive or note that brought them back — and how they felt (wowed, delighted, neutral, let down).",
      ] },
      { kind: "h", text: "The lists that tell you who to act on" },
      { kind: "list", items: [
        "Win-back list — guests who haven't been in for 30+ days, sorted most-overdue first, so a lapsing regular gets a nudge before they're gone for good.",
        "Ready to refer — your happiest guests who haven't referred anyone yet. The guest you already won is your cheapest marketing channel; this is the list to ask.",
        "Reactions & referrals — every visit can carry a reaction, and a guest can be flagged as having referred a friend, so you can see your promoter-to-let-down ratio and your referral rate at a glance.",
        "Retention funnel — how many guests convert from visit 1→2, 2→3, and 3→4, so you can see exactly where you lose them.",
      ] },
      { kind: "tip", text: "Your repeat rate on the dashboard is driven by this data — the more consistently visits are logged, the more accurate your retention picture (and the sharper your win-back and referral lists)." },
      { kind: "note", text: "A POS or reservation system can push guests and visits automatically via the API, so no one has to enter them by hand." },
    ],
    links: [{ label: "Connecting your POS", href: "/help/api-and-integrations" }],
  },
  {
    slug: "training-programs",
    title: "Building training programs (and refining with AI)",
    summary: "Create role-specific training, then fine-tune it with plain-English AI feedback.",
    categoryId: "team",
    keywords: ["training", "standards", "role", "build training", "refine", "ai", "checklist", "sign-off"],
    body: [
      { kind: "p", text: "Training & Standards holds a program for each role (Host, Server, Bartender, Chef, Manager) split into hospitality behaviors and role-specific skills." },
      { kind: "image", src: "/help/training.png", alt: "The Training & Standards screen", caption: "A role's training program, with the Build and Refine with AI actions." },
      { kind: "h", text: "Build a program" },
      { kind: "steps", items: [
        "Open Training & Standards and pick a role.",
        "Click \"Build training program\".",
        "Paste your existing training, upload a file, or answer a few questions and let Wingman write a complete program.",
        "Review the draft — edit or remove any item — then click \"Save program\". Nothing is saved until you do.",
      ] },
      { kind: "h", text: "Refine with AI" },
      { kind: "p", text: "Once a program exists, use \"Refine with AI\" to improve it conversationally — ask it to add items, suggest ideas, reword, or remove. You review every proposed change before anything is applied." },
      { kind: "tip", text: "Try open-ended prompts like \"What am I missing for wine service?\" or \"Add items about remembering regulars' names.\"" },
    ],
    links: [{ label: "Hiring criteria", href: "/help/hiring-criteria" }, { label: "Guest Journey", href: "/help/guest-journey" }],
  },
  {
    slug: "guest-journey",
    title: "Guest Journey — mapping the experience moment by moment",
    summary: "Map your guest experience into ordered stages, each with a standard, a script, and what a manager inspects.",
    categoryId: "team",
    keywords: ["guest journey", "journey", "stages", "guest experience", "arrival", "greet", "the ask", "touchpoints", "moments", "script", "standard", "map", "refine", "ai feedback", "tone", "revise", "print", "pdf"],
    body: [
      { kind: "p", text: "Guest Journey maps your guest experience as an ordered sequence of moments — from the moment someone arrives to the goodbye and the ask for a review. Each stage is a designed touchpoint, not an accident, and together they're the backbone your team trains on and gets spot-checked against." },
      { kind: "image", src: "/help/guest-journey.png", alt: "The Guest Journey screen showing a stage card with its standard, example script, what to avoid, and what a manager inspects.", caption: "Each stage holds the standard, an example script, what to avoid, and what a manager inspects — with Refine with AI on every card." },
      { kind: "h", text: "What each stage holds" },
      { kind: "list", items: [
        "Why it matters — one line on the point of this moment.",
        "Avoid this — the common mistake that quietly kills it.",
        "The standard — the non-negotiable, observable behavior (with a number or trigger where it fits).",
        "Say / do — an example script in your restaurant's voice.",
        "Timing — a time standard if the moment has one (e.g. \"acknowledge within 10 seconds\").",
        "Manager inspects — the single thing a manager watches for to know the standard was hit.",
      ] },
      { kind: "h", text: "Generate your journey" },
      { kind: "steps", items: [
        "Open Guest Journey from the sidebar.",
        "Pick your service style (fine dining, fast-casual, bar, café, and so on).",
        "Click \"Generate my journey\" — Wingman writes stages tailored to your concept and culture.",
        "Edit any stage to make it yours, add or remove stages, or regenerate to start fresh.",
      ] },
      { kind: "h", text: "Refine a stage with AI" },
      { kind: "p", text: "Once the journey is generated, you can hand any single stage back to the AI with plain-English feedback — no need to regenerate the whole thing. It rewrites just that moment, in your restaurant's voice, and leaves every other stage untouched." },
      { kind: "steps", items: [
        "On any stage, click \"✨ Refine with AI\".",
        "Type what you want changed — the content or the tone (e.g. \"Warmer and more personal, and mention our house margarita by name\"), or tap a quick prompt like Make it warmer, Make it shorter, More upscale tone, Add an upsell, or Make it more specific.",
        "Click \"Apply with AI\". The stage rewrites in place and the card updates with the new copy.",
      ] },
      { kind: "tip", text: "The \"Manager inspects\" line on each stage is written as a yes/no observable — use it as your spot-check list on the floor so the standard actually gets held, shift to shift." },
      { kind: "h", text: "Inspect a stage & track the pass rate" },
      { kind: "p", text: "Managers can tap ✓ Met or ✗ Missed under any stage's \"Manager inspects\" line to log a spot-check against that standard. Each card then shows how often it was inspected in the last 30 days and the % met — so you can see which moment of the guest experience is actually holding up and which is slipping, instead of guessing." },
      { kind: "note", text: "The first stage always includes asking whether it's the guest's first visit (e.g. \"Is this your first time with us?\"). Spotting first-timers at the door feeds Guest Bounce Back — the program that turns first-timers into regulars — so it's built into stage one by design." },
      { kind: "h", text: "Log a first-timer on the spot" },
      { kind: "p", text: "The first stage has a \"Log a first-timer\" box — enter the guest's name (phone or email optional) and they're added to Guest Bounce Back immediately as a visit-1 guest, ready for visit-2 follow-up. No need to re-enter them later. Anyone who can add to Bounce Back can log one." },
      { kind: "note", text: "\"Refine with AI\" changes only the one stage. \"Regenerate\" (at the top) replaces the whole journey — so refine or edit in place once it's close. Managers and owners can generate, refine, and edit; staff can view." },
      { kind: "p", text: "Use \"Print / PDF\" in the top corner to print the full journey or save it as a PDF — handy for a training binder or a pre-shift huddle." },
    ],
    links: [{ label: "Building training programs", href: "/help/training-programs" }, { label: "Accountability & spot-checks", href: "/help/accountability-overview" }],
  },
  {
    slug: "hiring-criteria",
    title: "Hiring criteria & interview guides",
    summary: "Screen for the person, not the resume — and refine your criteria with AI.",
    categoryId: "team",
    keywords: ["hiring", "interview", "criteria", "traits", "green flag", "red flag", "refine", "ai"],
    body: [
      { kind: "p", text: "Hiring gives each role a set of traits, each with an interview question, a green flag (what a good answer sounds like), and a red flag." },
      { kind: "image", src: "/help/hiring.png", alt: "The Hiring screen", caption: "Hiring criteria — traits with an interview question, green flag, and red flag." },
      { kind: "steps", items: [
        "Open Hiring and pick a role.",
        "Click \"Build hiring criteria\" — paste or upload an existing guide, or build from scratch.",
        "Review the drafted traits — edit or remove any — then click \"Save criteria\". Nothing is saved until you do.",
        "Use \"Refine with AI\" to add or reword traits (e.g. \"Add a trait for handling an angry guest\"). Review, then apply.",
        "Use the interview guide to run consistent interviews.",
      ] },
      { kind: "tip", text: "When you click \"Score a candidate\" and pick the role, the interview questions for that role appear right on the scorecard — with each trait's green flag and red flag — so the manager can ask and score in one place. Use \"Hide interview questions\" to collapse them for a quicker score." },
      { kind: "note", text: "Training and hiring content is shared org-wide, so it's the same across all your locations." },
    ],
    links: [{ label: "Training programs", href: "/help/training-programs" }],
  },
  {
    slug: "accountability-overview",
    title: "Accountability: checks, coaching & scores",
    summary: "Spot-checks, daily and pre-shift checks, coaching flags, and your accountability score.",
    categoryId: "operations",
    keywords: ["accountability", "spot check", "daily checklist", "coaching", "flags", "score"],
    body: [
      { kind: "p", text: "Accountability keeps standards honest. Managers run spot-checks and daily/pre-shift checks; the system raises coaching flags when something drifts." },
      { kind: "image", src: "/help/accountability.png", alt: "The Accountability screen", caption: "Accountability — checks, the staff pre-shift card, and the completion report." },
      { kind: "list", items: [
        "Spot-checks — a quick score of a staff member on the key hospitality dimensions.",
        "Daily / pre-shift / ambiance checks — location checks a manager logs.",
        "Coaching flags — automatic nudges when discounts, follow-ups, or scores need a conversation.",
      ] },
      { kind: "p", text: "Your Accountability score at the top blends how consistently these checks are happening." },
    ],
    links: [{ label: "Staff pre-shift checklists", href: "/help/pre-shift-checklists" }],
  },
  {
    slug: "pre-shift-checklists",
    title: "Staff pre-shift checklists & the completion report",
    summary: "How staff complete their own pre-shift checklist and how managers see it.",
    categoryId: "operations",
    keywords: ["pre-shift", "checklist", "staff", "complete", "report", "who did", "accountability"],
    body: [
      { kind: "p", text: "Each staff member completes their own pre-shift checklist when they work — and managers get a report of who did." },
      { kind: "h", text: "For staff" },
      { kind: "steps", items: [
        "Open Accountability.",
        "In \"Your pre-shift checklist\", check off what you've done.",
        "Click Submit. It shows a green \"done for today\" with the time (you can Update it).",
      ] },
      { kind: "h", text: "For managers" },
      { kind: "p", text: "The \"Pre-shift checklist completion\" panel shows who completed today (with the time), plus a 30-day view of each person's last completion and total." },
      { kind: "note", text: "Wingman has no schedule, so no one is ever marked \"missing\" for a day they didn't work — completion is the signal. The 30-day view is how you spot someone genuinely falling off." },
    ],
  },
  {
    slug: "standout-audit",
    title: "The Standout Audit",
    summary: "Score your operation and find the single most important thing to fix first.",
    categoryId: "operations",
    keywords: ["audit", "standout", "health score", "gaps", "constraint"],
    body: [
      { kind: "p", text: "The Standout Audit scores your operation across the five gaps and key domains, then gives you a Health Score and the one constraint to fix first." },
      { kind: "image", src: "/help/standout-audit.png", alt: "The Standout Audit screen", caption: "The Standout Audit — score your operation and get your Health Score." },
      { kind: "steps", items: [
        "Open Standout Audit.",
        "Score each area honestly.",
        "Submit — Wingman generates an action plan and your Health Score, and surfaces the \"fix first\" item on your dashboard.",
      ] },
    ],
  },
  {
    slug: "revenue-growth-planner",
    title: "Revenue Growth Planner",
    summary: "Model how small retention gains compound into revenue.",
    categoryId: "growth",
    keywords: ["growth", "revenue", "planner", "customers", "average sale", "repurchase"],
    body: [
      { kind: "p", text: "The Revenue Growth Planner turns three numbers — customers, average sale, and repurchase frequency — into a picture of how retention drives revenue." },
      { kind: "image", src: "/help/revenue-growth-planner.png", alt: "The Revenue Growth Planner screen", caption: "The Revenue Growth Planner — model how retention compounds into revenue." },
      { kind: "p", text: "Enter your numbers per period, or have your POS push them weekly via the API so the planner stays current automatically." },
    ],
    links: [{ label: "Connecting your POS", href: "/help/api-and-integrations" }],
  },
  {
    slug: "menu-engineering",
    title: "Menu Engineering",
    summary: "Plot items by popularity and profitability to find your stars and your dogs.",
    categoryId: "growth",
    keywords: ["menu", "engineering", "popularity", "profit", "food cost", "stars", "dogs"],
    body: [
      { kind: "p", text: "Menu Engineering plots each item by how popular and how profitable it is, so you can promote your stars and rework the rest." },
      { kind: "image", src: "/help/menu-engineering.png", alt: "The Menu Engineering screen", caption: "Menu Engineering — items plotted by popularity and profitability." },
      { kind: "p", text: "Add items with their price and food cost, or sync them from your POS via the API — send units sold and Wingman ranks popularity for you." },
    ],
    links: [{ label: "Connecting your POS", href: "/help/api-and-integrations" }],
  },
  {
    slug: "reporting",
    title: "Reporting",
    summary: "Every section's numbers in one view, over the date range you pick.",
    categoryId: "operations",
    keywords: ["reporting", "reports", "analytics", "metrics", "date range", "overview", "trend", "cohort", "repeat rate", "scheduled report", "email report", "digest", "week over week"],
    body: [
      { kind: "p", text: "Reporting rolls up every section into a single view for the date range you choose — retention, checks, training, comps, and more." },
      { kind: "image", src: "/help/reporting.png", alt: "The Reporting screen", caption: "Reporting — every section, one view, for the range you pick." },
      { kind: "h", text: "Trends over time" },
      { kind: "list", items: [
        "Repeat rate by cohort — for each of the last 6 months, the share of that month's first-timers who came back for a 2nd visit. It's the truest read on whether you're turning guests into regulars, and it shows the direction, not just today's number.",
        "The money layer — once your POS data is flowing, the latest week's net sales, average check, labor %, and comp % each show their week-over-week change.",
        "Training vs. retention — team training completion and repeat rate side by side, month by month, so you can see them move together: a team held to standard brings more guests back.",
        "Menu profitability — your menu items sorted into Stars, Plowhorses, Puzzles, and Dogs, with a one-line takeaway (e.g. how many Dogs are dragging your margin) pulled straight from Menu Engineering.",
      ] },
      { kind: "h", text: "Scheduled email reports" },
      { kind: "p", text: "Owners can have a report emailed automatically on a schedule — weekly, biweekly, or monthly — to whoever needs it (you, an investor, a GM). Click \"Schedule report,\" pick the cadence, the sections to include, and the recipient emails. Each recipient gets a clean digest on cadence without anyone lifting a finger." },
      { kind: "note", text: "Reporting is available to owners and (view-only) managers." },
    ],
  },
  {
    slug: "setup-wizard",
    title: "The Setup Wizard",
    summary: "Answer a few questions and Wingman builds your whole system at once.",
    categoryId: "getting-started",
    keywords: ["setup", "wizard", "onboarding", "get started", "build system", "quick start"],
    body: [
      { kind: "p", text: "The Setup Wizard is the fastest way to stand up Wingman: answer a few questions about your restaurant and it generates your culture, values, pre-shift focus, and role training in one pass." },
      { kind: "image", src: "/help/setup-wizard.png", alt: "The Setup Wizard screen", caption: "The Setup Wizard — go from zero to a full system in a few answers." },
      { kind: "note", text: "The Setup Wizard is owner-only. You can always refine anything it creates afterward." },
    ],
    links: [{ label: "Building training programs", href: "/help/training-programs" }],
  },
  {
    slug: "team-and-permissions",
    title: "Team members & permissions",
    summary: "Invite, edit, and set what each person can access.",
    categoryId: "admin",
    keywords: ["team", "invite", "members", "permissions", "edit", "remove", "roles", "access"],
    body: [
      { kind: "p", text: "Owners manage the team under Settings → Team & permissions." },
      { kind: "steps", items: [
        "Invite: click \"Invite team member\", set their name, email, role, and location access. They get an email to set a password.",
        "Edit: click \"Edit\" on any member to change their name, access level, or which locations they can access.",
        "Remove: remove a member to revoke their access entirely.",
      ] },
      { kind: "note", text: "You can't remove or demote the last Super Admin — promote someone else first. Settings and Billing are always owner-only." },
    ],
    links: [{ label: "Roles & who can see what", href: "/help/roles-and-access" }],
  },
  {
    slug: "locations",
    title: "Managing locations",
    summary: "Add, edit, and remove locations — and how billing follows.",
    categoryId: "admin",
    keywords: ["locations", "add location", "edit location", "delete", "multi-location", "billing"],
    body: [
      { kind: "p", text: "Owners manage locations under Settings → Locations." },
      { kind: "list", items: [
        "Add one or several locations at once.",
        "Edit a location's name, address, phone, or email.",
        "Remove a location (you'll be asked to reassign anyone based there first).",
      ] },
      { kind: "note", text: "Billing is per-location: adding or removing a location updates your monthly total automatically once billing is connected." },
    ],
    links: [{ label: "Billing", href: "/help/billing" }],
  },
  {
    slug: "billing",
    title: "Billing",
    summary: "How billing works, statement descriptor, and what happens if a payment fails.",
    categoryId: "admin",
    keywords: ["billing", "payment", "card", "statement", "the maverick agency", "past due", "invoice"],
    body: [
      { kind: "p", text: "Billing lives under Settings → Billing and is only visible to the account owner. Pricing is $199 for your first location plus $100 per additional location, billed monthly." },
      { kind: "note", text: "Billing is handled by The Maverick Agency — charges appear on your statement as \"The Maverick Agency.\"" },
      { kind: "h", text: "If a payment fails" },
      { kind: "p", text: "You'll be emailed to update your card, and a past-due banner appears in Billing. If the balance stays unpaid for 30 days, the account is suspended per the Terms — so update your card promptly." },
    ],
  },
  {
    slug: "api-and-integrations",
    title: "Connecting your POS (API & Zapier)",
    summary: "Create an API key and push data from your POS or a Zap.",
    categoryId: "integrations",
    keywords: ["api", "integration", "pos", "zapier", "key", "sync", "webhook", "developer"],
    body: [
      { kind: "p", text: "Wingman has a small API so your POS or a Zapier automation can keep it in sync — for example, pushing weekly numbers into the Business Health card and Revenue Growth Planner, syncing guests, or updating the menu." },
      { kind: "diagram", name: "pos-sync", caption: "Your POS or a Zap pushes data through the API into each Wingman tool." },
      { kind: "steps", items: [
        "Go to Settings → API access (Super Admin only).",
        "Create a key and copy it — the full key is shown only once.",
        "Give it (with the Developer Guide) to whoever builds the integration, or set up a Zap yourself using the Webhooks by Zapier action.",
      ] },
      { kind: "list", items: [
        "Business Health — push weekly sales, labor, comps, covers, and checks.",
        "Revenue Growth Planner — push customers, average sale, and repurchase frequency.",
        "Guests — push guests and their visits.",
        "Menu — sync menu items with price, cost, and units sold.",
      ] },
      { kind: "tip", text: "The Developer Guide (a branded, printable PDF) has every endpoint, example, and setup step — hand it to your developer." },
    ],
    links: [
      { label: "Open the Developer Guide", href: "/api-guide", external: true },
      { label: "Business Health card", href: "/help/reading-your-dashboard" },
    ],
  },
  {
    slug: "contact-support",
    title: "Contacting support",
    summary: "Open a ticket when you need a hand — and follow the conversation right in the app.",
    categoryId: "getting-started",
    keywords: ["support", "ticket", "contact", "help", "email", "question", "problem", "issue"],
    body: [
      { kind: "p", text: "If you can't find an answer here, open a support ticket and the Wingman team will help." },
      { kind: "steps", items: [
        "Scroll to the bottom of the Help Center and click \"Contact support\".",
        "Give it a subject and describe what you need — then submit.",
        "You'll get replies by email and can follow (and reply to) the whole thread under Support.",
      ] },
      { kind: "note", text: "Your Super Admins and Managers can see and reply to tickets from your organization; staff see the ones they filed." },
    ],
    links: [{ label: "Open a ticket", href: "/support", external: true }],
  },
  {
    slug: "reset-your-password",
    title: "Resetting your password",
    summary: "How to get back in if you forget your password.",
    categoryId: "admin",
    keywords: ["password", "reset", "forgot", "login", "sign in", "recovery"],
    body: [
      { kind: "steps", items: [
        "On the login page, click \"Forgot password?\".",
        "Enter your email — you'll always see the same confirmation.",
        "If an account exists, you'll get a reset link by email. Open it and set a new password.",
      ] },
      { kind: "note", text: "For security we show the same message whether or not the email has an account, so the page can't be used to discover who has one." },
    ],
  },
];

export function getArticle(slug: string): HelpArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function articlesByCategory(categoryId: string): HelpArticle[] {
  return ARTICLES.filter((a) => a.categoryId === categoryId);
}
