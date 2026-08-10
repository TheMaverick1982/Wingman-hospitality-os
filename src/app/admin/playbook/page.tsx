import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { listAllPosts, lastScheduledDate, scheduledFuture, PLAYBOOK_CATEGORIES } from "@/lib/playbook";
import { lastNewsjackRun, type NewsjackOutcome } from "@/lib/newsjack";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "The Playbook · Admin" };
export const maxDuration = 60;

// Presentational map for the "last news scan" heartbeat line.
const OUTCOME_META: Record<NewsjackOutcome, { label: string; dot: string; text: string }> = {
  drafted: { label: "Drafted a post", dot: "bg-[#15803D]", text: "text-[#15803D]" },
  skipped: { label: "Nothing timely to ride", dot: "bg-[#B45309]", text: "text-[#B45309]" },
  no_fresh_news: { label: "No fresh news", dot: "bg-muted-2", text: "text-muted" },
  error: { label: "Scan error", dot: "bg-danger", text: "text-danger" },
};

function agoLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function AdminPlaybookPage() {
  await requirePlatformSection("social");
  const [posts, lastScheduled, pending, lastScan] = await Promise.all([listAllPosts(), lastScheduledDate(), scheduledFuture(), lastNewsjackRun()]);
  const scanMeta = lastScan ? OUTCOME_META[lastScan.outcome] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">The Playbook</h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">Draft actionable, SEO-focused posts (with AI or by hand), review them, and publish to the public site at /playbook. Posts are scheduled Tuesdays and Thursdays at noon Eastern, and auto-publish (and post to Facebook) once you approve them.</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-[12.5px]">
          <span className="font-semibold text-charcoal-2">News scanner</span>
          {lastScan && scanMeta ? (
            <>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${scanMeta.dot}`} />
              <span className={`font-semibold ${scanMeta.text}`}>{scanMeta.label}</span>
              <span className="text-muted-2">· {agoLabel(lastScan.ranAt)}{lastScan.trigger === "manual" ? " (manual)" : ""}{lastScan.considered > 0 ? ` · ${lastScan.considered} scanned` : ""}</span>
            </>
          ) : (
            <span className="text-muted-2">· runs daily at 9am ET — no scan logged yet</span>
          )}
        </div>
      </div>
      <Composer
        categories={[...PLAYBOOK_CATEGORIES]}
        posts={posts}
        lastScheduled={lastScheduled}
        pendingApproval={pending.filter((p) => !p.approved).length}
        scheduledCount={pending.length}
      />
    </div>
  );
}
