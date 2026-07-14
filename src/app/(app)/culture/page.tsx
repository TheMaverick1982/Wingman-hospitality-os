import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection } from "@/lib/auth/permissions";
import { getStaffMembers } from "@/lib/data/staff";
import { Pill } from "@/components/ui/pill";
import { SampleRibbon } from "@/components/ui/sample-ribbon";
import { MomentModalButton } from "./moment-form";
import { WeeklyFocusForm } from "./weekly-focus-form";
import { CultureTextForm } from "./culture-text-form";

const AVATAR_TONES = [
  { bg: "bg-brick-tint", fg: "text-brick-dark" },
  { bg: "bg-[#E7F6EC]", fg: "text-[#15803D]" },
  { bg: "bg-[#FDF3E1]", fg: "text-[#B45309]" },
  { bg: "bg-[#F1F1F1]", fg: "text-charcoal-2" },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysAgoLabel(dateStr: string): string {
  const diffDays = Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

export default async function CulturePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const canEdit = canEditSection(profile.accessRole, "culture", profile.permissionOverrides);

  const supabase = await createClient();
  const ninetyDaysAgo = daysAgoIso(90);
  const [{ data: org }, { data: coreValues }, { data: moments }, { count: momentsThisQtr }, staff] = await Promise.all([
    supabase.from("organizations").select("philosophy, weekly_focus, x_factor, weekly_experiment, system_generated").single(),
    supabase.from("core_values").select("title, description").order("sort_order"),
    supabase
      .from("culture_moments")
      .select("id, author, about, tag, message, occurred_on")
      .order("occurred_on", { ascending: false }),
    supabase.from("culture_moments").select("id", { count: "exact", head: true }).gte("occurred_on", ninetyDaysAgo),
    getStaffMembers(null),
  ]);

  // Culture statement + values are seeded defaults until the wizard personalizes
  // them (system_generated). Flag that to editors so they know to make it theirs.
  const isSample = canEdit && !(org as { system_generated?: boolean } | null)?.system_generated;

  const allMoments = moments ?? [];
  const leaderboard = Object.entries(
    allMoments.reduce<Record<string, number>>((acc, m) => {
      acc[m.author] = (acc[m.author] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Your culture, in your words</h1>
          <p className="text-base text-muted">The standard every hire is trained to and every shift is measured against.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a href="/print/culture" target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-charcoal-2 border border-line rounded-full px-4 py-2 hover:border-brick hover:text-brick transition-colors">
            Print / PDF
          </a>
          {!canEdit && <Pill>View only</Pill>}
          {canEdit && <MomentModalButton staff={staff} />}
        </div>
      </div>

      <div>
        {isSample && <SampleRibbon what="culture statement & values" />}
        <div className="bg-[#0A0A0A] rounded-[20px] p-8 sm:p-12 text-white">
          <div className="text-xs font-semibold tracking-[0.08em] uppercase text-[#4D97FF] mb-5">Culture statement</div>
          <div className="text-2xl sm:text-[34px] font-semibold tracking-[-0.02em] leading-[1.3] max-w-[820px]">
            &quot;{org?.philosophy}&quot;
          </div>
        </div>
      </div>

      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Your X-Factor</div>
        <div className="text-[13px] text-muted mt-0.5 mb-3">
          The one thing you do better than anyone — the reason a guest picks you over the place next door. Name it, and
          every role reinforces it.
        </div>
        {canEdit ? (
          <CultureTextForm
            field="x_factor"
            initialValue={org?.x_factor ?? ""}
            placeholder="e.g. We remember every regular's name and drink — no one in town comes close."
            accent="ink"
          />
        ) : (
          <p className="text-sm text-ink">{org?.x_factor || "Not defined yet."}</p>
        )}
      </div>

      <div>
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-4">Core values</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {(coreValues ?? []).map((v, i) => (
            <div key={v.title} className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <div className="w-9 h-9 rounded-[10px] bg-brick-tint text-brick flex items-center justify-center text-[15px] font-bold mb-4">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="text-base font-semibold tracking-[-0.01em] text-ink mb-1.5">{v.title}</div>
              <div className="text-[13px] text-muted leading-[1.45]">{v.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-gold-tint rounded-2xl p-6">
          <h3 className="font-display text-base font-semibold text-[#b45309] mb-2">This week&apos;s pre-shift focus</h3>
          {canEdit ? (
            <WeeklyFocusForm initialValue={org?.weekly_focus ?? ""} />
          ) : (
            <p className="text-sm text-[#b45309]">{org?.weekly_focus || "Nothing set yet."}</p>
          )}
        </div>
        <div className="bg-gold-tint rounded-2xl p-6">
          <h3 className="font-display text-base font-semibold text-[#b45309] mb-1">This week&apos;s experiment</h3>
          <p className="text-xs text-[#b45309] mb-2">One small test to run this week — a new upsell, a new touch, a new table-side line.</p>
          {canEdit ? (
            <CultureTextForm
              field="weekly_experiment"
              initialValue={org?.weekly_experiment ?? ""}
              placeholder="e.g. Every server offers a dessert by name this week — see if attach rate moves."
            />
          ) : (
            <p className="text-sm text-[#b45309]">{org?.weekly_experiment || "Nothing set yet."}</p>
          )}
        </div>
      </div>

      <details className="bg-white border border-line rounded-2xl shadow-sm group">
        <summary className="flex items-center justify-between gap-3 p-6 cursor-pointer list-none">
          <div>
            <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Weekly manager huddle</div>
            <div className="text-[13px] text-muted mt-0.5">A 45-minute agenda that ends in action, not venting. Tap to open.</div>
          </div>
          <span className="text-muted-2 text-sm group-open:rotate-180 transition-transform">⌄</span>
        </summary>
        <div className="px-6 pb-6 -mt-1">
          <ol className="flex flex-col gap-3">
            {[
              { t: "Scoreboard — 10 min", d: "Last week vs. target: one win, one miss." },
              { t: "Constraint — 10 min", d: "Which gap is most open right now, and the one move to close it this week (check your Health Score)." },
              { t: "Recurring problem — 10 min", d: "Is this a one-off or a pattern? Anything recurring gets an owner and a system fix, not another reminder." },
              {
                t: "This week's focus & experiment — 5 min",
                d: org?.weekly_focus || org?.weekly_experiment
                  ? `Focus: ${org?.weekly_focus || "—"}${org?.weekly_experiment ? ` · Experiment: ${org.weekly_experiment}` : ""}`
                  : "Set the one behavior to drill and one test to run.",
              },
              { t: "Recognition — 5 min", d: "Name specific staff wins out loud." },
              {
                t: "Anticipation — once a quarter only",
                d: "Quick scan: any new competitor, wage/cost change, key-staff life event, or shift in guest demand to plan around? Skip most weeks.",
              },
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full border border-line bg-panel text-brick font-mono text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink">{step.t}</div>
                  <div className="text-[13px] text-muted leading-relaxed">{step.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </details>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Culture moments</span>
            <span className="text-[13px] font-semibold text-muted">{momentsThisQtr ?? 0} this quarter</span>
          </div>
          <div className="flex flex-col gap-4">
            {allMoments.slice(0, 6).map((m) => {
              const tone = toneFor(m.author);
              return (
                <div key={m.id} className="flex gap-3.5 items-start">
                  <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold ${tone.bg} ${tone.fg}`}>
                    {initialsOf(m.author)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm leading-[1.45]">
                      <span className="font-semibold text-ink">{m.author}</span>{" "}
                      <span className="text-charcoal-2">recognized {m.about}: {m.message}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-semibold text-brick-dark bg-brick-tint px-2.5 py-0.5 rounded-full">{m.tag}</span>
                      <span className="text-[12.5px] text-muted-2">{daysAgoLabel(m.occurred_on)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {allMoments.length === 0 && (
              <p className="text-sm text-muted">No culture moments yet. Recognize someone to start the wall.</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-ink mb-5">Most recognized</div>
          <div className="flex flex-col gap-3.5">
            {leaderboard.map(([name, count], i) => {
              const tone = toneFor(name);
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-muted-2 w-4 tabular-nums">{i + 1}</span>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${tone.bg} ${tone.fg}`}>
                    {initialsOf(name)}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-ink">{name}</div>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-ink">{count}</span>
                </div>
              );
            })}
            {leaderboard.length === 0 && <p className="text-sm text-muted">No recognitions yet.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
