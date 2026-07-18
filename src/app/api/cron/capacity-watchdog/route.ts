import { NextResponse, type NextRequest } from "next/server";
import { runCapacityCheck } from "@/lib/capacity-monitor";

// Daily capacity watchdog. Measures usage against each service's plan limit and
// emails the owner when something crosses 70% (warn) / 90% (critical), deduped to
// once per metric+level per 30 days. See src/lib/capacity-monitor.ts.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runCapacityCheck();
  return NextResponse.json({
    ok: true,
    breaches: result.breaches,
    alerted: result.alerted,
    metrics: result.metrics.map((m) => ({ metric: m.metric, level: m.level, display: m.display, pct: Math.round(m.ratio * 100) })),
  });
}
