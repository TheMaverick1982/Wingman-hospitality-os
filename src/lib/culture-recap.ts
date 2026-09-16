import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAiUsage } from "@/lib/ai/usage";
import { HOSPITALITY_DOCTRINE } from "@/lib/ai-doctrine";

// The Monthly Culture Recap — an AI-written read on how a restaurant's culture
// actually showed up over the past month: recognition, the anonymous team pulse
// (and its trend), and the experiments they ran. Shared by the on-demand
// "Preview recap" button and the scheduled recap cron so both produce the same
// warm, honest, owner-facing summary.

const SYSTEM = `You are a trusted advisor writing a short MONTHLY culture recap for the owner of ONE restaurant. You are given the real numbers from the past month — team recognition, an anonymous team "pulse" (how the team feels), and the experiments they ran. Write a warm but honest recap the owner reads in under a minute. Celebrate what's real, name what's slipping without sugar-coating, and end with one concrete focus for next month.

${HOSPITALITY_DOCTRINE}

Output these sections with these EXACT markdown bold headers and nothing before or after:
**The month in a line** — one sentence capturing how culture went this month.
**Recognition** — 1–3 bullets: how much the team recognized each other, who stood out, and which of the owner's core values showed up most (and any that were quiet).
**How the team feels** — 1–3 bullets reading the anonymous pulse honestly, calling out the trend vs last month. If there were no check-ins, say so plainly and encourage getting the first ones.
**What you tried** — 1–2 bullets on the experiments run and how they turned out. If none, gently nudge to run one.
**Focus for next month** — one sentence: the single highest-leverage culture move to make.
Keep it tight and specific to the data. Never invent numbers or names that aren't provided.`;

export type CultureRecapStats = {
  momentCount: number;
  shoutoutCount: number;
  pulseCount: number;
  experimentCount: number;
};
export type CultureRecapResult = { error: string | null; summary?: string; monthLabel?: string; stats?: CultureRecapStats };

// The calendar month the recap covers. `asOf` defaults to now; the cron passes
// the 1st, so the recap covers the month that just ended.
function recapWindow(asOf: Date): { startIso: string; endIso: string; monthLabel: string; period: string; prevPeriod: string } {
  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1)); // first of current month
  const start = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 1, 1)); // first of prev month
  const prev = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 2, 1));
  const monthLabel = start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const period = start.toISOString().slice(0, 7); // YYYY-MM of the covered month
  const prevPeriod = prev.toISOString().slice(0, 7);
  return { startIso: start.toISOString(), endIso: end.toISOString(), monthLabel, period, prevPeriod };
}

export async function composeCultureRecap(
  admin: SupabaseClient,
  opts: { orgId: string; orgName: string; asOf?: Date },
): Promise<CultureRecapResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Wingman's AI is temporarily unavailable. Please try again in a moment." };

  const { startIso, endIso, monthLabel, period, prevPeriod } = recapWindow(opts.asOf ?? new Date());
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);

  // Recognition moments in the covered month (occurred_on is a date).
  const { data: momentRows } = await admin
    .from("culture_moments")
    .select("kind, about, value_id")
    .eq("org_id", opts.orgId)
    .gte("occurred_on", startDate)
    .lt("occurred_on", endDate);
  const moments = (momentRows ?? []) as { kind: string | null; about: string | null; value_id: string | null }[];
  const shoutouts = moments.filter((m) => (m.about ?? "").trim());

  // Core values map (separate read — no fragile embed).
  const { data: cvRows } = await admin.from("core_values").select("id, title").eq("org_id", opts.orgId);
  const valueTitle = new Map(((cvRows ?? []) as { id: string; title: string }[]).map((v) => [v.id, v.title]));

  const recognizedTally = new Map<string, number>();
  for (const m of shoutouts) {
    const who = (m.about ?? "").trim();
    if (who) recognizedTally.set(who, (recognizedTally.get(who) ?? 0) + 1);
  }
  const topRecognized = [...recognizedTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const valueTally = new Map<string, number>();
  for (const m of moments) {
    const t = m.value_id ? valueTitle.get(m.value_id) : null;
    if (t) valueTally.set(t, (valueTally.get(t) ?? 0) + 1);
  }
  const topValues = [...valueTally.entries()].sort((a, b) => b[1] - a[1]);
  const quietValues = [...valueTitle.values()].filter((t) => !valueTally.has(t));

  // Anonymous pulse — covered month vs the month before, for the trend.
  const { data: pulseRows } = await admin
    .from("culture_pulse_responses")
    .select("period, recognized, values_clear, proud, comment")
    .eq("org_id", opts.orgId)
    .in("period", [period, prevPeriod]);
  const pulse = (pulseRows ?? []) as { period: string; recognized: number | null; values_clear: number | null; proud: number | null; comment: string | null }[];
  const avg = (nums: (number | null)[]) => {
    const xs = nums.filter((n): n is number => n != null);
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
  };
  const nowRows = pulse.filter((r) => r.period === period);
  const prevRows = pulse.filter((r) => r.period === prevPeriod);
  const pulseNow = {
    count: nowRows.length,
    recognized: avg(nowRows.map((r) => r.recognized)),
    valuesClear: avg(nowRows.map((r) => r.values_clear)),
    proud: avg(nowRows.map((r) => r.proud)),
    comments: nowRows.map((r) => (r.comment ?? "").trim()).filter(Boolean).slice(0, 8),
  };
  const pulsePrev = {
    count: prevRows.length,
    recognized: avg(prevRows.map((r) => r.recognized)),
    valuesClear: avg(prevRows.map((r) => r.values_clear)),
    proud: avg(prevRows.map((r) => r.proud)),
  };

  // Experiments closed during the covered month.
  const { data: expRows } = await admin
    .from("culture_experiments")
    .select("hypothesis, outcome, outcome_note, closed_on")
    .eq("org_id", opts.orgId)
    .gte("closed_on", startDate)
    .lt("closed_on", endDate)
    .order("closed_on", { ascending: false })
    .limit(10);
  const experiments = (expRows ?? []) as { hypothesis: string; outcome: string | null; outcome_note: string | null }[];

  const stats: CultureRecapStats = {
    momentCount: moments.length,
    shoutoutCount: shoutouts.length,
    pulseCount: pulseNow.count,
    experimentCount: experiments.length,
  };

  // If literally nothing happened, there's no recap to write.
  if (moments.length === 0 && pulseNow.count === 0 && experiments.length === 0) {
    return { error: "No culture activity to recap for this period yet.", monthLabel, stats };
  }

  const { data: org } = await admin.from("organizations").select("owner_mindset, weekly_focus").eq("id", opts.orgId).maybeSingle();
  const mindset = (org as { owner_mindset?: string | null } | null)?.owner_mindset ?? "";

  const trendLine = (label: string, now: number | null, prev: number | null) => {
    if (now == null) return `${label}: no data`;
    const d = prev != null ? Math.round((now - prev) * 10) / 10 : null;
    return `${label}: ${now}/5${d != null ? ` (${d > 0 ? "+" : ""}${d} vs last month)` : ""}`;
  };

  const dataBlock = [
    `RECOGNITION (${moments.length} moment${moments.length === 1 ? "" : "s"}, ${shoutouts.length} naming a teammate):`,
    topRecognized.length ? `- Most recognized: ${topRecognized.map(([n, c]) => `${n} (${c})`).join(", ")}` : "- No individual shout-outs.",
    topValues.length ? `- Values showing up: ${topValues.map(([t, c]) => `${t} (${c})`).join(", ")}` : "- No values tagged in recognition.",
    quietValues.length ? `- Quiet values (no recognition this month): ${quietValues.join(", ")}` : "",
    "",
    `TEAM PULSE (anonymous, ${pulseNow.count} check-in${pulseNow.count === 1 ? "" : "s"} this month, ${pulsePrev.count} last month):`,
    `- ${trendLine("Feel recognized", pulseNow.recognized, pulsePrev.recognized)}`,
    `- ${trendLine("Clear on values", pulseNow.valuesClear, pulsePrev.valuesClear)}`,
    `- ${trendLine("Proud to work here", pulseNow.proud, pulsePrev.proud)}`,
    pulseNow.comments.length ? `- Anonymous comments: ${pulseNow.comments.map((c) => `"${c}"`).join(" ")}` : "",
    "",
    `EXPERIMENTS CLOSED THIS MONTH (${experiments.length}):`,
    ...(experiments.length
      ? experiments.map((e) => `- "${e.hypothesis}" → ${e.outcome ?? "no outcome recorded"}${e.outcome_note ? `: ${e.outcome_note}` : ""}`)
      : ["- None closed."]),
  ]
    .filter((l) => l !== "")
    .join("\n");

  const prompt = `Monthly culture recap for ${opts.orgName} — covering ${monthLabel}.${
    mindset ? `\n\nThe owner's mindset (reflect its spirit): ${mindset}` : ""
  }\n\n${dataBlock}\n\nWrite the recap in the five sections specified.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 800, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const dataJson = await res.json();
    await recordAiUsage({ orgId: opts.orgId, feature: "culture_recap", model: "claude-sonnet-5", usage: dataJson.usage });
    const text = (dataJson.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("The recap came back empty. Try again.");
    return { error: null, summary: text, monthLabel, stats };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't generate the recap. Try again.", monthLabel, stats };
  }
}
