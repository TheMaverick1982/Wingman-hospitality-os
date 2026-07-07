import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

const PILLARS = [
  { glyph: "◆", title: "Culture", body: "A statement and five values in your voice — the standard the whole team shares." },
  { glyph: "◇", title: "Training", body: "Role-by-role training and sign-offs, from the interview to daily habits." },
  { glyph: "✓", title: "Accountability", body: "Spot-checks and checklists that measure whether the standard is actually kept." },
  { glyph: "↺", title: "Retention", body: "Every guest journey tracked, so first visits turn into loyal regulars." },
];

const STEP1 = [
  "A culture statement written in your voice, not generic corporate language",
  "Five core values, specific to how you want guests treated",
  "Hiring guidance matched to those same values",
];
const VALUES = ["Warm, not scripted", "Own the moment", "Anticipate", "Every guest a regular", "Leave it better"];

const STEP2 = [
  "Interview guides and scorecards built from your values",
  "Department-specific training for Host, Server, Bartender, Chef, and Manager",
  "A real sign-off log — not a binder no one reads",
];
const SIGNOFFS = [
  { name: "Greeting within 30 seconds", role: "Host · M. Reyes", status: "Signed off", fg: "text-[#15803D]", bg: "bg-[#E7F6EC]", dot: "bg-[#16A34A]" },
  { name: "Wine pairing knowledge", role: "Server · J. Okafor", status: "In progress", fg: "text-brick-dark", bg: "bg-brick-tint", dot: "bg-brick" },
  { name: "Recovery on comped check", role: "Manager · A. Bianchi", status: "Needs coaching", fg: "text-[#B45309]", bg: "bg-[#FDF3E1]", dot: "bg-[#D97706]" },
  { name: "Bar close checklist", role: "Bartender · T. Nguyen", status: "Signed off", fg: "text-[#15803D]", bg: "bg-[#E7F6EC]", dot: "bg-[#16A34A]" },
];

const STEP3 = [
  "Daily opening and closing checklists per role",
  "Pre-shift rituals that keep the standard front of mind",
  "Manager spot-checks that measure the moments guests feel",
];
const CHECKLIST = [
  { label: "Stations stocked and wiped down", done: true },
  { label: "Specials and 86 list reviewed", done: true },
  { label: "Section assignments confirmed", done: true },
  { label: "Guest notes checked for regulars", done: true },
  { label: "Pre-shift tasting complete", done: false },
];

const JOURNEY = [
  { visit: "Visit 1", title: "First impression", body: "Logged with the incentive or channel that brought them in." },
  { visit: "Visit 2", title: "The bounce-back", body: "Wingman flags who came back — and who almost didn't." },
  { visit: "Visit 3", title: "Becoming a regular", body: "Preferences and notes travel with the guest, every location." },
  { visit: "Visit 4+", title: "Loyal regular", body: "The profitable relationship you built on purpose, not by luck." },
];

const STEP5 = [
  "Automatic flags when discounts or recovery spike",
  "Reasons attached to every comp, so patterns surface",
  "Coaching assigned in the moment, tracked to resolution",
];

const SUPER_ADMIN_POINTS = ["Every location, side by side", "Standards, sign-offs, and trends org-wide", "Where culture is strong and where it's slipping"];
const MANAGER_POINTS = ["Their own floor, in full detail", "Their team's training and daily checklists", "Coaching flags for their shifts"];

function Checkmarks({ items }: { items: string[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      {items.map((i) => (
        <div key={i} className="flex gap-3 items-start">
          <span className="shrink-0 w-5 h-5 rounded-full bg-brick-tint text-brick flex items-center justify-center text-xs mt-0.5">✓</span>
          <span className="text-base text-ink leading-[1.45]">{i}</span>
        </div>
      ))}
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="flex-1 flex flex-col">
      <MarketingNav />

      <div style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)" }}>
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-20 sm:pb-[120px] text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brick-tint mb-7">
            <span className="w-[7px] h-[7px] rounded-full bg-brick" />
            <span className="text-[13px] font-semibold text-brick-dark">How Wingman works</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-[80px] leading-[1.0] tracking-[-0.035em] font-bold text-ink mx-auto mb-7 max-w-[960px]">
            Set your standard. Train your team. Keep your guests.
          </h1>
          <p className="text-lg sm:text-[22px] leading-[1.5] text-muted mx-auto max-w-[620px]">
            Wingman builds a complete culture, training, and accountability system around your
            restaurant — then runs it with you, shift after shift. Here&apos;s the whole loop.
          </p>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-10">
        <div className="max-w-[720px] mb-14">
          <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-5">The idea</div>
          <h2 className="font-display text-[32px] sm:text-4xl lg:text-5xl leading-[1.08] tracking-[-0.025em] font-bold text-ink mb-5">
            Four things that turn a first visit into a regular.
          </h2>
          <p className="text-lg sm:text-xl text-muted leading-[1.5]">
            Great hospitality isn&apos;t luck or a poster on the wall. It&apos;s four connected
            systems — and Wingman runs all four in one place.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-paper rounded-3xl p-8">
              <div className="w-12 h-12 rounded-[13px] bg-white flex items-center justify-center mb-6 shadow-sm text-brick text-[22px]">
                {p.glyph}
              </div>
              <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink mb-2.5">{p.title}</h3>
              <p className="text-[15px] text-muted leading-[1.5]">{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-[72px] items-center">
          <div>
            <div className="text-[15px] font-bold text-brick mb-4">Step 01</div>
            <h2 className="font-display text-3xl sm:text-4xl leading-[1.1] tracking-[-0.02em] font-bold text-ink mb-5">
              Define your standard
            </h2>
            <p className="text-lg text-muted leading-[1.55] mb-7">
              Wingman asks a few sharp questions about your concept, price point, and what great
              service looks like at your place. From your answers, it writes a culture statement
              in your voice and five core values — the standard everything else is built on.
            </p>
            <Checkmarks items={STEP1} />
          </div>
          <div className="bg-paper rounded-3xl p-9">
            <div className="text-xs font-semibold tracking-[0.08em] uppercase text-muted-2 mb-3.5">Your culture statement</div>
            <div className="text-[22px] font-semibold tracking-[-0.01em] leading-[1.3] mb-7 text-ink">
              &quot;Every guest leaves feeling like a regular — even on their first visit.&quot;
            </div>
            <div className="text-xs font-semibold tracking-[0.08em] uppercase text-muted-2 mb-3.5">Core values</div>
            <div className="flex flex-wrap gap-2.5">
              {VALUES.map((v) => (
                <span key={v} className="bg-white rounded-full px-4 py-2 text-sm font-semibold text-ink shadow-sm">
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-paper">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-[72px] items-center">
            <div className="bg-white border border-line rounded-3xl overflow-hidden shadow-md">
              <div className="px-6 py-5 border-b border-line text-sm font-semibold text-ink">
                Sign-off log · Downtown flagship
              </div>
              {SIGNOFFS.map((s) => (
                <div key={s.name} className="flex items-center justify-between px-6 py-4 border-b border-line last:border-b-0">
                  <div>
                    <div className="text-[15px] font-medium text-ink">{s.name}</div>
                    <div className="text-[13px] text-muted-2 mt-0.5">{s.role}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.fg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-[15px] font-bold text-brick mb-4">Step 02</div>
              <h2 className="font-display text-3xl sm:text-4xl leading-[1.1] tracking-[-0.02em] font-bold text-ink mb-5">
                Build the team around it
              </h2>
              <p className="text-lg text-muted leading-[1.55] mb-7">
                Hiring guidance matched to your values helps you screen for the right people. Then
                each role — Host, Server, Bartender, Chef, Manager — gets department-specific
                training with a real sign-off log, so you always know who&apos;s ready and who
                needs another pass.
              </p>
              <Checkmarks items={STEP2} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-[72px] items-center">
          <div>
            <div className="text-[15px] font-bold text-brick mb-4">Step 03</div>
            <h2 className="font-display text-3xl sm:text-4xl leading-[1.1] tracking-[-0.02em] font-bold text-ink mb-5">
              Run the daily habits
            </h2>
            <p className="text-lg text-muted leading-[1.55] mb-7">
              The standard only matters if it happens every shift. Daily checklists and pre-shift
              rituals turn it into muscle memory, and manager spot-checks measure whether the
              moments guests actually feel are landing — open to close.
            </p>
            <Checkmarks items={STEP3} />
          </div>
          <div className="bg-paper rounded-3xl p-8">
            <div className="flex items-center justify-between mb-5">
              <div className="text-[15px] font-semibold text-ink">Opening checklist · Server</div>
              <span className="text-[13px] font-semibold text-[#15803D] bg-[#E7F6EC] px-2.5 py-1 rounded-full">
                4 / 5 done
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {CHECKLIST.map((c) => (
                <div key={c.label} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm">
                  <span
                    className={`shrink-0 w-[22px] h-[22px] rounded-[7px] flex items-center justify-center text-[13px] ${
                      c.done ? "bg-brick text-white" : "bg-white border-2 border-line-strong"
                    }`}
                  >
                    {c.done ? "✓" : ""}
                  </span>
                  <span className={`text-[15px] ${c.done ? "text-muted-2 line-through" : "text-ink"}`}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0A0A0A] text-white">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <div className="max-w-[720px] mb-14">
            <div className="text-[15px] font-bold text-[#4D97FF] mb-4">Step 04</div>
            <h2 className="font-display text-[32px] sm:text-[44px] leading-[1.08] tracking-[-0.022em] font-bold mb-5">
              Track every guest&apos;s journey
            </h2>
            <p className="text-lg sm:text-[19px] text-[#A1A1A1] leading-[1.55]">
              Wingman logs first-time guests and the incentive that brought them back — visit by
              visit, across every location. Every discount and service recovery gets a reason
              attached, so recurring problems surface instead of hiding in a spreadsheet.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {JOURNEY.map((j) => (
              <div key={j.visit} className="bg-[#171717] border border-[#2A2A2A] rounded-2xl p-7">
                <div className="text-[13px] font-semibold tracking-[0.06em] uppercase text-[#4D97FF] mb-4">
                  {j.visit}
                </div>
                <div className="text-lg font-semibold tracking-[-0.01em] mb-2">{j.title}</div>
                <div className="text-sm text-[#A1A1A1] leading-[1.5]">{j.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-paper">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-[72px] items-center">
            <div className="bg-white border border-line rounded-3xl p-8 shadow-md">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-10 h-10 rounded-[11px] bg-[#FDF3E1] text-[#D97706] flex items-center justify-center text-lg">
                  !
                </span>
                <div>
                  <div className="text-[15px] font-semibold text-ink">Coaching flag</div>
                  <div className="text-[13px] text-muted-2">Raised 2 hours ago · Bar</div>
                </div>
              </div>
              <div className="text-base text-ink leading-[1.5] mb-5">
                Comped checks are up 3 shifts running, all tagged &quot;wait time.&quot; Pattern
                flagged for the closing manager before it becomes normal.
              </div>
              <div className="flex gap-2.5">
                <span className="bg-brick-tint text-brick-dark rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
                  Assign coaching
                </span>
                <span className="bg-paper text-[#525252] rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
                  View trend
                </span>
              </div>
            </div>
            <div>
              <div className="text-[15px] font-bold text-brick mb-4">Step 05</div>
              <h2 className="font-display text-3xl sm:text-4xl leading-[1.1] tracking-[-0.02em] font-bold text-ink mb-5">
                Coach before it becomes a pattern
              </h2>
              <p className="text-lg text-muted leading-[1.55] mb-7">
                Spot-checks, daily manager checklists, and automatic flags mean coaching happens in
                the moment — not during a quarterly review when the habit has already set in.
                Small corrections, early, compound into a team that holds the standard on its own.
              </p>
              <Checkmarks items={STEP5} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-20 sm:py-28">
        <div className="max-w-[720px] mb-14">
          <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-5">
            Built for every location
          </div>
          <h2 className="font-display text-[32px] sm:text-4xl lg:text-5xl leading-[1.08] tracking-[-0.025em] font-bold text-ink mb-5">
            One system. The right view for everyone.
          </h2>
          <p className="text-lg sm:text-xl text-muted leading-[1.5]">
            Built-in permissions mean everyone sees exactly what they need — nothing more, nothing
            less.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="border border-line rounded-3xl p-10">
            <div className="text-xl font-semibold tracking-[-0.01em] text-ink mb-2">Super Admins</div>
            <p className="text-base text-muted leading-[1.5] mb-5">See everything, everywhere.</p>
            <div className="flex flex-col gap-3">
              {SUPER_ADMIN_POINTS.map((i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="shrink-0 w-[18px] h-[18px] rounded-full bg-brick-tint text-brick flex items-center justify-center text-[11px] mt-0.5">
                    ✓
                  </span>
                  <span className="text-[15px] text-ink leading-[1.45]">{i}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-line rounded-3xl p-10">
            <div className="text-xl font-semibold tracking-[-0.01em] text-ink mb-2">Managers</div>
            <p className="text-base text-muted leading-[1.5] mb-5">Focused on their own floor.</p>
            <div className="flex flex-col gap-3">
              {MANAGER_POINTS.map((i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="shrink-0 w-[18px] h-[18px] rounded-full bg-brick-tint text-brick flex items-center justify-center text-[11px] mt-0.5">
                    ✓
                  </span>
                  <span className="text-[15px] text-ink leading-[1.45]">{i}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-paper">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-24 sm:py-32 text-center">
          <h2 className="font-display text-4xl sm:text-5xl lg:text-[60px] leading-[1.04] tracking-[-0.03em] font-bold text-ink mb-6">
            See the whole loop
            <br />
            on your own floor.
          </h2>
          <p className="text-lg sm:text-[21px] text-muted leading-[1.5] max-w-[560px] mx-auto mb-10">
            Set your standard once, and Wingman runs culture, training, and accountability with you
            from the first shift.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="text-[17px] font-semibold text-white bg-brick rounded-full px-8 py-[15px] hover:bg-brick-dark transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/pricing"
              className="text-[17px] font-semibold text-ink bg-white border border-line-strong rounded-full px-[30px] py-3.5 hover:bg-[#efefef] transition-colors"
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
