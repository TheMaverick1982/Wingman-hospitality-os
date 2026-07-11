// Verbatim nurture-sequence copy from the Wingman automation spec (packages
// 01-demo-sandbox-nurture, 02-calculator-nurture, 03-scorecard-nurture).
// Seeded into crm_sequences/crm_sequence_steps by /api/crm/seed-nurtures.
// Cadence is day 0/1/3/6/9/13 from enrollment; delay_days === day. Email 1 of
// the calculator + scorecard sequences is transactional (delivers the requested
// result, bypassing the send window). Body/subject support merge fields resolved
// at send time by renderMerge() in crm-merge.ts.

export type NurtureStep = {
  step_order: number;
  delay_days: number;
  subject: string;
  body: string;
  transactional: boolean;
  send_condition: "always" | "activated" | "not_activated";
};
export type NurtureSequence = { source: string; name: string; steps: NurtureStep[] };

export const NURTURE_SEQUENCES: NurtureSequence[] = [
  {
    source: "demo",
    name: "Demo Sandbox Nurture",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "Your demo workspace (+ the 3 things worth breaking first)",
        body: "{{contact.first_name}} —\n\nYour sandbox is live. Everything in it is fake — the restaurant group, the staff, the guests — so change anything, break whatever you want.\n\nThree things worth poking at first:\n\n1. **The repeat-guest view** — this is the number the whole product exists to move.\n2. **A manager scorecard** — open any location and see how accountability actually looks shift to shift.\n3. **The training builder** — generate a training doc for a made-up role and watch what comes out.\n\nThe sandbox shows you the product. What it can't show you is what *your* numbers would look like in it. That's a 20-minute call, whenever you're ready: {{calendar.booking_link}}\n\nBrian\nFounder, Wingman",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 2,
        delay_days: 1,
        subject: "Did you find the Tuesday problem?",
        body: "Most operators who explore the sandbox click around the training tools first. Fair — they're the shiny part.\n\nBut the part that changes how you run the company is buried one level deeper: the view that shows repeat-visit rate **by location, by shift**. In the demo data, there's a location whose Tuesday PM shift converts first-timers at half the rate of its Friday crew. Same menu. Same prices. Different people, different standards.\n\nEvery multi-location group has a version of that shift. Most just can't see it.\n\nGo find it in the sandbox — then imagine that view with your locations in it.\n\nBrian\n\nP.S. If you'd rather I just show you: {{calendar.booking_link}}",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 3,
        delay_days: 3,
        subject: "What the sandbox can't tell you",
        body: "The sandbox answers \"what is this thing?\"\n\nIt can't answer the questions that actually decide whether Wingman is worth your time:\n\n— What would rollout look like across *your* locations without a training week?\n— How does it sit alongside what you already run (POS, scheduling, your current checklists)?\n— What's a realistic repeat-rate lift for *your* concept, and how fast?\n\nThose are specific to your group, and they're exactly what a demo call is for. 20 minutes, no deck, mostly me asking about your operation and showing you the parts that map to it.\n\n{{calendar.booking_link}}\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 4,
        delay_days: 6,
        subject: "The most expensive guest in your restaurant",
        body: "Quick math, because this is the whole reason Wingman exists:\n\nA first-time guest at a $45 average check who never comes back is worth $45.\nThe same guest converted into a regular at 2–3 visits a month is worth **over $1,000 a year** — per guest, per location, at zero extra ad spend.\n\nMost full-service restaurants lose the majority of first-timers forever. Not because the food failed — because nobody on shift was accountable for the moments that decide a second visit.\n\nYou already paid to win that guest once. Retention is just refusing to pay to win them twice.\n\nIf you want the version of this math with your check average and location count: {{calendar.booking_link}} — I'll build it live on the call.\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 5,
        delay_days: 9,
        subject: "\"Not another app\" — agreed",
        body: "The most common pushback I hear from GMs: *\"my managers already have too many tabs open.\"*\n\nAgreed. That's why Wingman replaces things instead of adding to them — the paper checklists, the binder nobody reads, the training doc from 2022, the \"culture\" that lives in the owner's head. One place, and every piece of it points at one number: do first-timers come back?\n\nIf your managers would revolt at another login, that's exactly the conversation to have on a demo — bring your most skeptical GM: {{calendar.booking_link}}\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 6,
        delay_days: 13,
        subject: "Closing the loop",
        body: "{{contact.first_name}} — this is my last email about the sandbox.\n\nIf Wingman didn't click, no hard feelings — the demo workspace stays available if you want another look later.\n\nIf it *did* click and the timing's just wrong, reply with \"later\" and I'll check back in a quarter instead of filling your inbox.\n\nAnd if you're on the fence, the fastest way off it is 20 minutes with your real numbers: {{calendar.booking_link}}\n\nEither way — thanks for kicking the tires.\n\nBrian\nFounder, Wingman — guest retention for restaurants",
        transactional: false,
        send_condition: "always",
      },
    ],
  },
  {
    source: "calculator",
    name: "Calculator Nurture",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "Your retention breakdown: {{contact.calc_annual_upside}}/year on the table",
        body: "Here's the breakdown you ran:\n\n— New guests per month: **{{contact.calc_new_guests_month}}**\n— Average check: **{{contact.calc_avg_check}}**\n— Repeat rate today: **{{contact.calc_current_repeat_rate}}%**\n— Repeat rate target: **{{contact.calc_target_repeat_rate}}%**\n\n**Annual revenue difference: {{contact.calc_annual_upside}}**\n\nWorth saying out loud: that's revenue from guests you already paid to acquire. No new ad spend, no discounts — just more of your first-timers deciding to come back.\n\nThe gap between your current rate and your target isn't luck. It's whether every shift, at every location, delivers a visit worth repeating — and whether anyone's accountable when it doesn't.\n\nThat's the system Wingman builds. If you want to see what closing that gap actually looks like for your group, grab 20 minutes: {{calendar.booking_link}}\n\nBrian\nFounder, Wingman",
        transactional: true,
        send_condition: "always",
      },
      {
        step_order: 2,
        delay_days: 1,
        subject: "The two levers behind that {{contact.calc_annual_upside}}",
        body: "Every retention number breaks down into two levers:\n\n**1. Conversion** — does the first visit earn a second? This is decided in moments your P&L never sees: the greeting, the recovery when something goes wrong, whether anyone learned the guest's name.\n\n**2. Frequency** — does the second visit become a habit? Regulars at 2–3 visits a month are where the compounding lives.\n\nLoyalty apps attack lever 2 with discounts — renting visits with margin. The bigger, cheaper lever is #1, and it's a *people* lever: training, culture, and someone checking the standard held up tonight, at every location.\n\nThat's the unfashionable work. It's also the whole game.\n\nBrian\n\nP.S. Want to see how groups your size systematize lever 1? {{calendar.booking_link}}",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 3,
        delay_days: 3,
        subject: "Why repeat rate stays stuck at {{contact.calc_current_repeat_rate}}%",
        body: "Here's the pattern I see in multi-location groups:\n\nThe owner cares about retention. The GMs *say* they care. But nobody's number depends on it. Managers get graded on labor cost, food cost, reviews — activity metrics. So the shift-level behaviors that create a second visit happen when the good manager is on, and quietly don't when they're not.\n\nYour rate isn't stuck at {{contact.calc_current_repeat_rate}}% because your team can't do better. It's stuck because \"better\" isn't defined, trained, or checked — consistently, everywhere.\n\nSystems beat intentions. Every time.\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 4,
        delay_days: 6,
        subject: "How the number actually moves",
        body: "If you're wondering what Wingman concretely *does* to move {{contact.calc_current_repeat_rate}}% toward {{contact.calc_target_repeat_rate}}%, it's three connected pieces:\n\n1. **It generates your culture and training system** — for your concept, your roles, your standards. Not a template binder; the thing your team actually uses on shift.\n2. **It holds every role accountable, shift by shift** — so the standard survives the manager who's off tonight.\n3. **It tracks whether first-timers come back** — by location, by shift — so you coach with data instead of drive-bys.\n\nTraining tools measure course completion. Checklist apps measure tasks done. Wingman connects both to the only outcome that pays: the guest returned.\n\nTwenty minutes and I'll show you all three running: {{calendar.booking_link}}\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 5,
        delay_days: 9,
        subject: "{{contact.calc_annual_upside}} doesn't wait",
        body: "One more piece of math from your calculator run, and it's the uncomfortable one:\n\n{{contact.calc_annual_upside}} a year is roughly **{{contact.calc_annual_upside}} ÷ 12 every month** the gap stays open. The guests you didn't convert this month aren't queued up waiting — they found their new regular spot. That revenue doesn't defer; it expires.\n\nI'm not saying that to be dramatic. I'm saying it because \"we'll look at retention next quarter\" is the most expensive sentence in hospitality.\n\nIf the number's real enough to act on: {{calendar.booking_link}}\n\nBrian\n\n*(Build note: GHL can't do division in a merge tag — either send a `calc_monthly_upside` field from your page in the webhook payload and use that, or reword to \"divide it by twelve — that's the monthly bleed.\")*",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 6,
        delay_days: 13,
        subject: "Last one from me",
        body: "{{contact.first_name}} — I'll stop here.\n\nYou ran the numbers, so you know what's on the table: {{contact.calc_annual_upside}} a year between where your repeat rate is and where it could be.\n\nIf now's not the time, that's a real answer — reply \"later\" and I'll check back in a quarter. If it is, the next step is 20 minutes: {{calendar.booking_link}}\n\nEither way, keep the breakdown. The math will still be true when you're ready.\n\nBrian\nFounder, Wingman — guest retention for restaurants",
        transactional: false,
        send_condition: "always",
      },
    ],
  },
  {
    source: "scorecard",
    name: "Scorecard Nurture",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "Your Hospitality Score: {{contact.scorecard_score}}/10",
        body: "{{contact.first_name}} — here's your result.\n\n**Score: {{contact.scorecard_score}}/10**\n\nYour three biggest opportunities:\n\n1. {{contact.scorecard_gap_1}}\n2. {{contact.scorecard_gap_2}}\n3. {{contact.scorecard_gap_3}}\n\nTwo things worth knowing about this score. First, almost nobody gets a 10 — the questions describe an operation where retention is *systematized*, and nearly every group runs it on effort and good managers instead. Second, the gaps above aren't three separate problems. They're one problem wearing three outfits, and I'll show you what I mean over the next few emails.\n\nIf you'd rather skip ahead: 20 minutes and I'll walk you through exactly how groups like yours close all three: {{calendar.booking_link}}\n\nBrian\nFounder, Wingman",
        transactional: true,
        send_condition: "always",
      },
      {
        step_order: 2,
        delay_days: 1,
        subject: "Your #1 gap: {{contact.scorecard_gap_1}}",
        body: "Let's take your biggest one first: **{{contact.scorecard_gap_1}}**.\n\nHere's why this gap costs more than it looks like it does. Everything downstream — training, coaching, culture — is guesswork until this is fixed. You can't improve a number nobody's watching, and you can't hold a standard nobody's defined.\n\nThe good news: this is the *most* fixable kind of problem. It's not a talent problem or a concept problem. It's a systems problem, and systems can be installed.\n\nWingman installs it — usually live within the first shift, not a quarter-long rollout.\n\nWant to see what \"fixed\" looks like for this specific gap? {{calendar.booking_link}}\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 3,
        delay_days: 3,
        subject: "The pattern behind all three of your gaps",
        body: "Your other two flags: **{{contact.scorecard_gap_2}}** and **{{contact.scorecard_gap_3}}**.\n\nPut all three side by side and a pattern shows up — the same one I see in almost every multi-location scorecard:\n\n**The standard lives in people, not in a system.** Your best manager carries it. When they're on, the operation hums. When they're off — different restaurant, same sign on the door.\n\nThat's survivable at one location. At three, five, ten locations, it's a ceiling: you can't be everywhere, so the standard can't either.\n\nThe fix isn't hiring five more of your best manager. It's making the standard *portable* — defined, trained, checked every shift, and tied to whether guests come back.\n\nBrian\n\nP.S. That's the demo, basically: {{calendar.booking_link}}",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 4,
        delay_days: 6,
        subject: "What a 9/10 operation actually does",
        body: "Having seen a lot of these scorecards, here's what separates the rare high scorers. It's not budget, not a famous chef, not a lucky market:\n\n— They **track guest returns** like they track food cost — a number with an owner.\n— Training is **role-specific and current**, not a binder from two GMs ago.\n— Accountability is **shift-level**, not monthly-meeting-level. Tonight's standard gets checked tonight.\n— Culture is **written down and hired against**, so it survives turnover.\n\nNone of that requires more effort than you're already spending. It requires the effort to be *aimed* — which is exactly what a system is.\n\nYour score was {{contact.scorecard_score}}/10. Every point between that and 9 is a repeat guest you're currently losing to chance.\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 5,
        delay_days: 9,
        subject: "What your score costs in dollars",
        body: "A score is abstract. Dollars aren't, so here's the translation:\n\nFull-service restaurants lose most first-time guests forever. At a $45 average check, a converted regular at 2–3 visits a month is worth over $1,000 a year — per guest, per location. The gaps on your scorecard are the *mechanism* of that loss: untracked, untrained, unchecked moments that quietly send first-timers elsewhere.\n\nWe built a calculator that turns your actual volume and check average into the annual number: https://www.joinwingman.app/calculator — takes a minute, and it puts a dollar figure on your {{contact.scorecard_score}}/10.\n\nOr skip the homework and let me run it with you live: {{calendar.booking_link}}\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 6,
        delay_days: 13,
        subject: "Your scorecard, one last time",
        body: "{{contact.first_name}} — last email from me on this.\n\nYour three opportunities are still sitting there: {{contact.scorecard_gap_1}}, {{contact.scorecard_gap_2}}, {{contact.scorecard_gap_3}}. Scores don't fix themselves, but they also don't get worse for being ignored — what gets worse is the compounding of guests who didn't come back while the gaps stayed open.\n\nIf timing's the issue, reply \"later\" and I'll check in next quarter. If it's now: {{calendar.booking_link}} — 20 minutes, and we start with gap #1.\n\nThanks for taking the scorecard seriously enough to finish it. Most don't.\n\nBrian\nFounder, Wingman — guest retention for restaurants",
        transactional: false,
        send_condition: "always",
      },
    ],
  },
];

// Legacy source whose sequence is retired by the spec (folded into the demo funnel).
export const RETIRED_SOURCES = ["sales-chat"];
