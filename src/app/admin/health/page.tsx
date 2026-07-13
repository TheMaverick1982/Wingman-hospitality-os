import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { HealthClient, type ErrorEvent } from "./health-client";

export const metadata: Metadata = { title: "Health · Admin" };

export default async function HealthPage() {
  await requirePlatformSection("health");
  const admin = createAdminClient();

  const { data } = await admin
    .from("error_events")
    .select("id, fingerprint, message, stack, route, source, org_id, user_email, count, resolved, first_seen, last_seen")
    .order("last_seen", { ascending: false })
    .limit(300);
  const events = (data ?? []) as ErrorEvent[];

  const open = events.filter((e) => !e.resolved);
  const resolved = events.filter((e) => e.resolved);
  const totalHits = open.reduce((s, e) => s + (e.count ?? 1), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Health</h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Bugs customers are hitting in the live app, grouped so the same error is one issue. New bugs email you an alert with a
          fix-ready issue. Copy any issue here and hand it to Claude.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Stat label="Open bugs" value={open.length} tone={open.length ? "brick" : "olive"} />
        <Stat label="Total hits (open)" value={totalHits} tone="muted" />
        <Stat label="Resolved" value={resolved.length} tone="olive" />
      </div>

      <HealthClient open={open} resolved={resolved} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "brick" | "olive" | "muted" }) {
  const color = tone === "brick" ? "text-brick" : tone === "olive" ? "text-olive" : "text-ink";
  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
      <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-2">{label}</div>
      <div className={`text-[28px] font-bold tabular-nums mt-1 ${color}`}>{value}</div>
    </div>
  );
}
