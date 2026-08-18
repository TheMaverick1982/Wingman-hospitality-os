import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, Medal } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isManagerOrAbove } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeLeaderboard, BADGE_META, type LeaderRow } from "@/lib/leaderboard";
import { LeaderboardToggle } from "./toggle";

export const metadata = { title: "Training leaderboard — Wingman" };

const RANK_COLOR = ["text-[#B8860B]", "text-[#8C8C8C]", "text-[#A0522D]"]; // gold, silver, bronze

export default async function LeaderboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/dashboard");
  const isOwner = profile.accessRole === "super_admin";
  const canSpan = isManagerOrAbove(profile.accessRole) && profile.allLocations;

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("leaderboard_enabled").eq("id", profile.orgId).maybeSingle();
  const enabled = (org as { leaderboard_enabled?: boolean } | null)?.leaderboard_enabled ?? true;

  // Owners / all-location managers see the whole org; everyone else their location.
  const locationId = canSpan ? null : profile.locationId ?? null;
  const rows = enabled || isOwner ? await computeLeaderboard(profile.orgId, locationId) : [];

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <Link href="/training" className="text-brick font-semibold text-sm">← Training &amp; standards</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-ink text-white flex items-center justify-center shrink-0 mt-0.5"><Trophy size={20} /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Training leaderboard</h1>
            <p className="text-sm text-muted mt-1 max-w-xl">Points for passing tests, scoring well, and signing off training. A little friendly competition to keep the whole team sharp.</p>
          </div>
        </div>
      </div>

      {isOwner && (
        <div className="bg-white border border-line rounded-2xl px-5 py-4 shadow-sm">
          <LeaderboardToggle enabled={enabled} />
          {!enabled && <p className="text-[12.5px] text-muted-2 mt-2">Your team can&apos;t see the leaderboard while it&apos;s off. You can still see it here.</p>}
        </div>
      )}

      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-line text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-2 flex items-center justify-between">
          <span>Rank · Team member</span>
          <span>Points</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-2">No training activity yet. Assign a test and watch the board fill in.</div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r, i) => <Row key={r.staffId} row={r} rank={i + 1} />)}
          </div>
        )}
      </div>

      <div className="text-[12px] text-muted-2">
        <span className="font-semibold">How points work:</span> 10 for each test passed, a bonus for your average score, and 3 for each training sign-off.
      </div>
    </div>
  );
}

function Row({ row, rank }: { row: LeaderRow; rank: number }) {
  const top = rank <= 3;
  return (
    <div className="px-5 py-3 flex items-center gap-3">
      <div className={`w-7 text-center font-bold tabular-nums ${top ? RANK_COLOR[rank - 1] : "text-muted-2"}`}>
        {top ? <Medal size={18} className={`inline ${RANK_COLOR[rank - 1]}`} /> : rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-semibold text-ink truncate">{row.name}</div>
        <div className="text-[12px] text-muted-2 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span>{row.department}</span>
          <span>{row.testsPassed} passed{row.avgScore != null ? ` · ${row.avgScore}% avg` : ""}</span>
          {row.badges.map((b) => (
            <span key={b} title={BADGE_META[b].title} className="inline-flex items-center text-[10.5px] font-semibold uppercase tracking-wide text-brick-dark bg-brick-tint px-1.5 py-0.5 rounded-full">{BADGE_META[b].label}</span>
          ))}
        </div>
      </div>
      <div className="text-[16px] font-bold text-ink tabular-nums shrink-0">{row.points}</div>
    </div>
  );
}
