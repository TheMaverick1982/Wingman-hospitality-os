export type CoachingFlag = { tone: "brick" | "gold"; text: string };

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
  staffAverages: { name: string; avg: number }[];
  lastDailyCheck: { checked: boolean[] } | undefined;
}): CoachingFlag[] {
  const flags: CoachingFlag[] = [];

  if (Number(discountPct) > 4) {
    flags.push({ tone: "brick", text: `Discount rate is ${discountPct}% — above the 3–4% target. Review Service Recovery.` });
  }
  if (byCategory[0] && byCategory[0][1].count >= 2) {
    flags.push({ tone: "brick", text: `Recurring issue: "${byCategory[0][0]}" has come up ${byCategory[0][1].count} times. Coach this at pre-shift.` });
  }
  if (guestsAwaitingFollowUp > 0) {
    flags.push({
      tone: "gold",
      text: `${guestsAwaitingFollowUp} first-time guest${guestsAwaitingFollowUp > 1 ? "s haven't" : " hasn't"} been followed up for visit 2 yet (across all locations).`,
    });
  }
  for (const s of staffAverages) {
    if (s.avg < 3.5) {
      flags.push({ tone: "brick", text: `${s.name} is averaging ${s.avg.toFixed(1)}/5 on spot-checks — schedule a coaching session.` });
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
