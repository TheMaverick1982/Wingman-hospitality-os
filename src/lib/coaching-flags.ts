export type CoachingFlag = { tone: "danger" | "gold"; text: string };

export function computeCoachingFlags({
  discountPct,
  byCategory,
  guestsAwaitingFollowUp,
  staffAverages,
  lastDailyCheck,
}: {
  discountPct: string;
  byCategory: [string, { count: number; total: number }][];
  guestsAwaitingFollowUp: number;
  staffAverages: { name: string; avg: number; count?: number }[];
  lastDailyCheck: { checked: boolean[] } | undefined;
}): CoachingFlag[] {
  const flags: CoachingFlag[] = [];

  if (Number(discountPct) > 4) {
    flags.push({ tone: "danger", text: `Discount rate is ${discountPct}% — above the 3–4% target. Review Service Recovery.` });
  }
  if (byCategory[0] && byCategory[0][1].count >= 2) {
    flags.push({ tone: "danger", text: `Recurring issue: "${byCategory[0][0]}" has come up ${byCategory[0][1].count} times. Coach this at pre-shift.` });
  }
  if (guestsAwaitingFollowUp > 0) {
    flags.push({
      tone: "gold",
      text: `${guestsAwaitingFollowUp} first-time guest${guestsAwaitingFollowUp > 1 ? "s haven't" : " hasn't"} been followed up for visit 2 yet (across all locations).`,
    });
  }
  for (const s of staffAverages) {
    if (s.avg < 3.5) {
      if ((s.count ?? 1) >= 2) {
        flags.push({
          tone: "danger",
          text: `Recurring: ${s.name} has averaged ${s.avg.toFixed(1)}/5 across ${s.count} spot-checks — this is a pattern, not a bad shift. Fix the system, not just the person.`,
        });
      } else {
        flags.push({
          tone: "gold",
          text: `${s.name} scored ${s.avg.toFixed(1)}/5 on a spot-check — a one-off for now; coach it before it becomes a pattern.`,
        });
      }
    }
  }
  if (lastDailyCheck && lastDailyCheck.checked.filter(Boolean).length < lastDailyCheck.checked.length) {
    flags.push({
      tone: "gold",
      text: `The last manager checklist logged was incomplete (${lastDailyCheck.checked.filter(Boolean).length}/${lastDailyCheck.checked.length}).`,
    });
  }

  return flags;
}
