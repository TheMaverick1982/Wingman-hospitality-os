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
    keywords: ["dashboard", "repeat rate", "business health", "retention", "metrics", "needs attention"],
    body: [
      { kind: "p", text: "The dashboard is your morning glance. The top tiles show your repeat rate, spot-checks logged, sign-offs this week, and culture moments." },
      { kind: "image", src: "/help/dashboard.png", alt: "The Wingman dashboard", caption: "Your dashboard — health at a glance, with the Business Health card at the bottom." },
      { kind: "p", text: "The Guest Retention chart shows how many guests reach each return visit. \"Needs your attention\" surfaces the few things worth acting on today." },
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
    summary: "Log guests and their visits so you can turn first-timers into regulars.",
    categoryId: "guests",
    keywords: ["guests", "bounce back", "retention", "visits", "regulars", "follow up"],
    body: [
      { kind: "p", text: "Guest Bounce Back tracks each guest across their first four visits — the window where a first-timer becomes a regular." },
      { kind: "diagram", name: "retention-journey", caption: "The four-visit window where a first-timer becomes a regular." },
      { kind: "image", src: "/help/guest-bounce-back.png", alt: "The Guest Bounce Back screen", caption: "Guest Bounce Back — track each guest across their return visits." },
      { kind: "steps", items: [
        "Open Guest Bounce Back.",
        "Add a guest (name, and phone/email if you have it).",
        "Log each visit as they return, with the incentive or note that brought them back.",
      ] },
      { kind: "tip", text: "Your repeat rate on the dashboard is driven by this data — the more consistently visits are logged, the more accurate your retention picture." },
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
        "Either upload what you already use, or answer a few questions and let Wingman write a complete program.",
      ] },
      { kind: "h", text: "Refine with AI" },
      { kind: "p", text: "Once a program exists, use \"Refine with AI\" to improve it conversationally — ask it to add items, suggest ideas, reword, or remove. You review every proposed change before anything is applied." },
      { kind: "tip", text: "Try open-ended prompts like \"What am I missing for wine service?\" or \"Add items about remembering regulars' names.\"" },
    ],
    links: [{ label: "Hiring criteria", href: "/help/hiring-criteria" }],
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
        "Click \"Build hiring criteria\" — upload an existing guide or build from scratch.",
        "Use \"Refine with AI\" to add or reword traits (e.g. \"Add a trait for handling an angry guest\"). Review, then apply.",
        "Use the interview guide to run consistent interviews.",
      ] },
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
    keywords: ["reporting", "reports", "analytics", "metrics", "date range", "overview"],
    body: [
      { kind: "p", text: "Reporting rolls up every section into a single view for the date range you choose — retention, checks, training, comps, and more." },
      { kind: "image", src: "/help/reporting.png", alt: "The Reporting screen", caption: "Reporting — every section, one view, for the range you pick." },
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
