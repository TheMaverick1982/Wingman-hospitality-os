// Verbatim sequence copy from the Wingman automation spec (packages 01-demo,
// 02-calculator, 03-scorecard nurtures + 05-signup onboarding). Seeded into
// crm_sequences/crm_sequence_steps by /api/crm/seed-nurtures.
//
// Nurtures run day 0/1/3/6/9/13 from enrollment (delay_days === day); the
// calculator + scorecard first emails are transactional (deliver the requested
// result, bypassing the send window).
//
// The signup onboarding sequence (source "signup") is a day-0→14 branch: the
// day-5/8/11 emails carry send_condition "activated"/"not_activated", and the
// cron evaluates activation at send time — the "activated" arm goes to customers
// who've started using the product, the "not_activated" arm is the rescue path.
// It's started by markCustomerByEmail (the post-signup kill-switch → onboarding).
//
// Body/subject support merge fields resolved at send time by renderMerge().

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
        body: "One more piece of math from your calculator run, and it's the uncomfortable one:\n\n{{contact.calc_annual_upside}} a year is roughly **{{contact.calc_monthly_upside}} every month** the gap stays open. The guests you didn't convert this month aren't queued up waiting — they found their new regular spot. That revenue doesn't defer; it expires.\n\nI'm not saying that to be dramatic. I'm saying it because \"we'll look at retention next quarter\" is the most expensive sentence in hospitality.\n\nIf the number's real enough to act on: {{calendar.booking_link}}\n\nBrian",
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
  {
    source: "signup",
    name: "Customer Onboarding (post-signup)",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "Your Wingman workspace is live — do this first",
        body: "{{contact.first_name}} — welcome. {{contact.workspace_name}} is up and running.\n\nSkip the grand tour. Do this one thing today, because it's the fastest \"oh, I get it\" moment in the product:\n\n**Generate your culture & training system.** Tell Wingman about your concept and it drafts the standards, role training, and shift expectations your team runs on — the stuff that usually lives in a dusty binder or one great manager's head. Takes minutes, and everything else in Wingman builds on it.\n\nLog in, and it's the first thing the workspace asks you to do.\n\nAnd put Wingman on your phone while you're at it — it's where you'll use it every shift: joinwingman.app/download (App Store + Google Play).\n\nI'm Brian, the founder — replies to these emails come straight to me. Use that.\n\nBrian",
        transactional: true,
        send_condition: "always",
      },
      {
        step_order: 2,
        delay_days: 1,
        subject: "Put Wingman in your pocket",
        body: "{{contact.first_name}} — one quick setup thing: get Wingman on your phone. That's where it actually lives during a shift — checklists, training, and guest bounce-backs, right at the pass.\n\nApp Store + Google Play, both here: joinwingman.app/download\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 3,
        delay_days: 1,
        subject: "The binder problem (and why you just solved it)",
        body: "Every restaurant group has a version of the binder: the training doc from three years ago, the culture deck from the last offsite, the checklist taped by the POS. All written with good intentions. None of it alive on tonight's shift.\n\nWhat you generated yesterday (or will today) is different for one reason: **it's connected.** The standards feed the training, the training feeds shift-level accountability, and all of it points at one number — do first-time guests come back?\n\nToday's step: **review and edit what Wingman drafted.** It's your concept's system, not ours; make it sound like you. Ten minutes of edits now saves your managers a hundred questions later.\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 4,
        delay_days: 3,
        subject: "Want me to set it up with you? (30 min)",
        body: "{{contact.first_name}} — an offer, not a pitch:\n\nI do free 30-minute onboarding calls with new workspaces. We set up your locations and roles, tune the training to your concept, and get shift accountability live — so you leave the call with Wingman actually running, not a to-do list.\n\nGrab a slot: {{calendar.onboarding_link}}\n\nZero obligation — the workspace is free either way. I do these because set-up-right workspaces succeed and abandoned ones don't, and honestly because I learn something from every operator I talk to.\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 5,
        delay_days: 5,
        subject: "Wingman is a team sport",
        body: "A workspace with one user is a dashboard. A workspace with your managers in it is a system.\n\nToday's step: **invite your GMs** (Settings → Team). What changes when they're in:\n\n— Shift accountability starts running — the standard gets checked *tonight*, at every location, whether or not you're there.\n— Training gets assigned per role instead of forwarded and forgotten.\n— You start seeing consistency location by location, manager by manager.\n\nTip from watching rollouts: tell your GMs *why* before the invite lands — \"this replaces the binder and the paper checklists\" lands better than a mystery email from a new app.\n\nBrian",
        transactional: false,
        send_condition: "activated",
      },
      {
        step_order: 6,
        delay_days: 5,
        subject: "Did we lose you at hello?",
        body: "You created {{contact.workspace_name}} a few days ago and — unless my signals are lying — haven't been back in.\n\nNo guilt; you run restaurants, the to-do list is undefeated. But an empty workspace helps nobody, so let me make re-entry stupidly easy:\n\n**One step, ten minutes:** log in and generate your culture & training system. Wingman drafts it; you just answer a few questions about your concept. That single step is where most operators go \"ah — *that's* what this is.\"\n\nOr skip the solo attempt entirely: {{calendar.onboarding_link}} — 30 minutes, I set it up with you.\n\nBrian",
        transactional: false,
        send_condition: "not_activated",
      },
      {
        step_order: 7,
        delay_days: 8,
        subject: "Tonight's shift is the whole product",
        body: "Everything in Wingman exists for one moment: **a shift, tonight, meeting the standard even though nobody from HQ is watching.**\n\nIf your team's in and training is live, the accountability loop is what makes it stick: shifts get checked against the standard, misses become coaching moments with data attached, and patterns show up before they show up in reviews.\n\nThis week's step: run one full week of shift accountability at one location. Just one. You'll know within a week which shifts hold the standard and which ones are costing you second visits.\n\nBrian",
        transactional: false,
        send_condition: "activated",
      },
      {
        step_order: 8,
        delay_days: 8,
        subject: "I'll do the setup for you",
        body: "Last nudge, and it's my best offer:\n\nReply to this email with your concept name, number of locations, and your biggest consistency headache — **and I'll pre-build your workspace myself.** You log in to something already shaped like your operation instead of a blank page.\n\nFounder-doing-support isn't scalable, which is exactly why I can offer it right now and the bigger tools can't.\n\nIf Wingman's just not for you, that's fine too — reply \"not for us\" and I'll leave you be.\n\nBrian\nFounder, Wingman — guest retention for restaurants",
        transactional: false,
        send_condition: "not_activated",
      },
      {
        step_order: 9,
        delay_days: 11,
        subject: "The number all of this feeds",
        body: "Quick zoom out. Culture, training, shift accountability — they're inputs. The output is **repeat-guest rate**, and Wingman tracks it so you can manage retention like a number instead of a vibe.\n\nAs your visit data builds, watch it by location and by shift. That view is where operators find the money.\n\nOne more thing, since you're early with us: I'm selecting a handful of **design partner** groups — closer working relationship, white-glove help from me, direct input on the roadmap, in exchange for honest feedback and (if the numbers are good) a case study. If {{contact.workspace_name}} might be a fit, reply \"design partner\" and I'll send details.\n\nBrian",
        transactional: false,
        send_condition: "activated",
      },
      {
        step_order: 10,
        delay_days: 14,
        subject: "Two weeks in — honest question",
        body: "{{contact.first_name}} — you're two weeks into Wingman. One question, and I genuinely want the answer either way:\n\n**Is it running, or did it stall?**\n\nIf it's running — brilliant. Reply and tell me the first thing that surprised you; it shapes what we build next.\n\nIf it stalled — even more useful. Reply with the one-word reason (time? team? confusing?) or just grab a slot and I'll unstick it with you: {{calendar.onboarding_link}}\n\nEvery restaurant group that gets value from Wingman had a moment where it almost stalled. The difference was never talent. It was a nudge at week two.\n\nConsider this the nudge.\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
    ],
  },
  {
    source: "demo-no-show",
    name: "Demo No-Show Re-Engagement",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "We missed each other",
        body: "{{contact.first_name}} — no stress, restaurant life happens. A no-show to a software demo usually means a walk-in rush, a callout, or both.\n\nGrab a better time here: {{calendar.booking_link}}\n\nIf the timing's just wrong this month, reply and tell me — I'd rather wait than chase.\n\n{{rep_name}}",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 2,
        delay_days: 2,
        subject: "Should I close your file?",
        body: "I'll assume the timing isn't right and stop nudging after this one.\n\nBefore I do — the reason you reached out hasn't gone anywhere. First-time guests are still walking out the door unconverted, every shift.\n\nOne click if you want that conversation: {{calendar.booking_link}}\n\nEither way — good luck out there.\n\n{{rep_name}}",
        transactional: false,
        send_condition: "always",
      },
    ],
  },
  {
    source: "referral",
    name: "Customer Referral Ask (day 30)",
    steps: [
      {
        step_order: 1,
        delay_days: 30,
        subject: "A favor — know another operator we could help?",
        body: "{{contact.first_name}} — you're about a month into Wingman now, so I wanted to ask you something directly.\n\nDo you know another restaurant operator fighting the same battle — pouring money into winning guests, then watching too many never come back?\n\nIf someone comes to mind, I'd genuinely love an introduction. Not for a hard sell — I'd rather just help them the way I hope we've helped you. The best operators I know all lift each other up, and honestly that's how Wingman grows too: one operator telling another. We all do better when we help each other grow.\n\nAn intro can be as simple as forwarding this email, or a quick note like:\n\n\"Hey [name] — you've heard me complain about getting more regulars back in the door. I've been using Wingman for exactly that. Might be worth a look: https://www.joinwingman.app/demo — happy to intro you to Brian, the founder, if you want.\"\n\nThat's it. Just reply with a name (or cc us) and I'll take it from there — and I'll make sure they're taken care of.\n\nEither way, thank you for being one of the early ones. It genuinely means a lot.\n\nBrian\nFounder, Wingman\n\nP.S. If you'd rather make it official, we have a simple referral program too: https://www.joinwingman.app/affiliates",
        transactional: false,
        send_condition: "always",
      },
    ],
  },
  {
    source: "reactivation",
    name: "Reactivation (win-back after cancel)",
    steps: [
      {
        step_order: 1,
        delay_days: 30,
        subject: "The door's still open, {{contact.first_name}}",
        body: "{{contact.first_name}} — I noticed you're no longer on Wingman, and I didn't want that to pass without a note.\n\nNo pitch here. I just wanted you to know we've kept your setup exactly where you left it — your culture, your standards, your guest journey. If the timing was just off, it's all still here whenever you want it back.\n\nAnd if Wingman wasn't the right fit, I'd genuinely love to know why — a one-line reply helps us more than you'd think.\n\nEither way, I'm rooting for your restaurant.\n\nBrian\nFounder, Wingman",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 2,
        delay_days: 60,
        subject: "One idea you can use tonight (no strings)",
        body: "{{contact.first_name}} — a quick one, whether or not you ever come back to Wingman.\n\nThe single cheapest way to grow a restaurant is bringing back the guests you already won. So here's a play you can run tonight: have your host quietly flag every first-timer, and make sure a manager does one specific thing before they leave — name a dish to come back for, or hand them a reason to return this week.\n\nThat one habit moves your repeat rate more than almost anything on the marketing side. It's the whole idea behind Wingman, but you don't need us to start doing it.\n\nHope it helps.\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 3,
        delay_days: 90,
        subject: "A few things have changed since you left",
        body: "{{contact.first_name}} — thought you'd want to know we've shipped a lot since you were last in Wingman.\n\nA couple of the bigger ones: your Reporting now shows repeat rate as a real trend over time (so you can actually see if guests are coming back), and the Guest Journey maps every moment of the experience and lets you spot-check that it's happening on the floor.\n\nNo ask — just didn't want you judging us on the old version. If you're ever curious, your account's a click away.\n\nBrian",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 4,
        delay_days: 120,
        subject: "Your Wingman setup is still saved",
        body: "{{contact.first_name}} — a small heads-up: everything you built in Wingman is still saved on your account. You wouldn't be starting over — you'd be switching it back on.\n\nIf getting more of your guests to come back is on your list for this season, I'd be glad to hop on a quick call and help you pick it back up where it makes the most sense. Just reply and we'll find a time — no pressure if now's not it.\n\nBrian\nFounder, Wingman",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 5,
        delay_days: 150,
        subject: "Last note from me, {{contact.first_name}}",
        body: "{{contact.first_name}} — I won't keep filling your inbox, so this is my last note.\n\nThe door stays open. If the day comes when you want a simple system for turning first-timers into regulars, your account and everything in it will be right here waiting.\n\nUntil then, I'm cheering for you and your team. Thanks for giving us a shot the first time around.\n\nBrian\nFounder, Wingman",
        transactional: false,
        send_condition: "always",
      },
    ],
  },
  {
    // Fires the moment someone books a demo (native calendar → recordDemoBooked).
    // Deliberately PREP-only and short so it never collides with the transactional
    // confirmation + 24h/1h reminders the calendar already sends, and never runs
    // post-demo (the no-show / customer paths own what happens after the meeting).
    source: "booked",
    name: "Demo Booked — Prep",
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: "You're booked — here's how to get the most out of it",
        body: "{{contact.first_name}} — you're on the calendar, and I'm looking forward to it.\n\nQuick heads-up so it's the best 30 minutes we can spend: come with the one number that keeps you up at night — how many of your first-time guests actually come back. If you don't know it, that's fine, that's kind of the point.\n\nIt helps to have in mind: how you train your team today, and what happens (if anything) after a guest's first visit. We'll build the demo around your restaurant, not a generic tour.\n\nYou'll get the join link and reminders separately. If anything changes, there's a reschedule link in your confirmation — no need to cancel and start over.\n\nSee you soon,\n{{rep_name}}",
        transactional: true,
        send_condition: "always",
      },
    ],
  },
  {
    // Fires when someone cancels a booked demo (native calendar → recordDemoCanceled).
    // The transactional cancel email with the rebook link goes out immediately from
    // the calendar; this win-back starts a couple days later so it doesn't stack on
    // top of it. Rebooking stops this sequence automatically (recordDemoBooked stops
    // all active enrollments).
    source: "demo-cancel",
    name: "Demo Cancel — Re-Book",
    steps: [
      {
        step_order: 1,
        delay_days: 2,
        subject: "Want to grab a new time?",
        body: "{{contact.first_name}} — no worries at all about cancelling; restaurant life doesn't care what's on the calendar.\n\nThe reason you booked in the first place hasn't gone anywhere, though — too many first-time guests still walking out and never coming back. Whenever you've got 30 minutes, I'd still love to show you how operators fix that.\n\nGrab whatever time works: {{calendar.booking_link}}\n\n{{rep_name}}",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 2,
        delay_days: 7,
        subject: "One play you can run without us",
        body: "{{contact.first_name}} — whether or not we ever get that demo on the books, here's something you can use tonight.\n\nHave your host quietly flag every first-timer, and make sure a manager does one specific thing before they leave: name a dish to come back for, or hand them a reason to return this week. That single habit moves your repeat rate more than almost anything on the marketing side.\n\nThat's the whole idea behind Wingman — and if you want to see the system that makes it automatic, the door's open: {{calendar.booking_link}}\n\n{{rep_name}}",
        transactional: false,
        send_condition: "always",
      },
      {
        step_order: 3,
        delay_days: 14,
        subject: "Should I close your file?",
        body: "{{contact.first_name}} — I'll stop nudging after this one.\n\nIf the timing's just wrong right now, no hard feelings — reply and tell me and I'll check back another season. If you'd still like to see it, here's the link one more time: {{calendar.booking_link}}\n\nEither way, I'm rooting for you and your team.\n\n{{rep_name}}",
        transactional: false,
        send_condition: "always",
      },
    ],
  },
];

// Legacy source whose sequence is retired by the spec (folded into the demo funnel).
export const RETIRED_SOURCES = ["sales-chat"];
