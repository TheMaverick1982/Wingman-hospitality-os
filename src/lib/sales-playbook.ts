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
];

export type ProductArea = { name: string; what: string; problem: string };

export const PRODUCT_TOUR: ProductArea[] = [
  { name: "Guest Bounce Back", what: "Logs guests and their return visits, then hands you the action lists: a win-back list of guests who've gone quiet 30+ days, and a 'ready to refer' list of your happiest guests who haven't referred anyone yet.", problem: "Owners have no idea who came once and never returned — this makes the first-timer-to-regular journey visible and tells the team exactly who to call, win back, and ask for a referral." },
  { name: "Guest Journey", what: "Maps the whole guest experience into ordered moments, each with a standard, a script, and what a manager inspects — and lets the host log a first-timer at the door straight into Bounce Back.", problem: "The experience is left to chance and memory; this turns it into a designed, repeatable playbook, and makes sure no first-time guest slips away uncaptured." },
  { name: "Culture", what: "Captures the owner's standard, core values, and weekly focus in their own words.", problem: "Culture is felt but never written down, so it can't be trained or scaled to new hires and second locations." },
  { name: "Training & Standards", what: "Builds role-by-role training programs with a real sign-off log.", problem: "New hires 'pick it up as they go,' so the experience drifts. This makes training consistent and provable." },
  { name: "Accountability", what: "Spot-checks, daily and pre-shift checklists, and automatic coaching flags.", problem: "Standards slip the moment the owner isn't watching; this inspects what they expect, every shift." },
  { name: "Service Recovery", what: "Tracks comps and how guest issues were made right.", problem: "A bad moment quietly loses a guest forever; this makes recovery a habit, not an accident." },
  { name: "Hiring, Growth & Menu", what: "Interview criteria that screen for the person, plus revenue and menu-engineering tools.", problem: "Rounds out the system — better people, and the numbers to grow profitably." },
  { name: "Reporting", what: "Rolls every section into one view, shows repeat rate by cohort over the last 6 months and week-over-week money trends, a retention-ROI card that puts real dollars on the regulars they've won back vs. the money still on the table, and can email a scheduled digest to the owner or an investor.", problem: "Operators fly blind on whether things are actually improving — this turns the whole system into a trend they (and their investors) can watch, and translates guest work into the dollar language owners actually decide on." },
  { name: "14-Day Launch Plan", what: "A dated rollout on the Start Here page: a few moves every few days across four phases, each milestone checking itself off as they do the work, with an on-track / overdue status and a short weekly accountability email nudging their next move.", problem: "Answers the objection every operator has — 'we bought software before and never used it.' This makes implementation fast and accountable, so they actually run it and get a return instead of it gathering dust." },
  { name: "Momentum score", what: "A usage score on the dashboard, separate from Business Health: five weekly habits, a streak, and the single next move when they drift — plus a friendly email nudge if a week goes quiet.", problem: "Extends the launch accountability past week two. It keeps the habits alive long-term (and catches a stalling account early), which is what actually protects their results — and their subscription." },
  { name: "Weekly 3 moves", what: "A dashboard commitment card where the owner picks up to three concrete moves for the week and ticks them off as they go.", problem: "Turns good intentions into a finite, checkable commitment. Three things you'll actually do beats a bottomless to-do list — it's the simplest habit that keeps an operator moving week to week." },
];

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
  { label: "Know roughly what they'd pay", detail: "Standard pricing is $199/mo for the first location + $100/mo per additional location. Don't lead with price — but never be caught off guard by it." },
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
    ],
    doThis: [
      "Before you show anything, play their problem back until they say \"that's right.\" That's your green light — once you've got it, the demo lands. If you don't, keep listening.",
      "Mirror their words as you click: \"this is that first-timer problem you mentioned.\"",
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
