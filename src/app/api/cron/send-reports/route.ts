import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { stageOf, type GuestWithVisits } from "@/lib/hospitality";

const FREQUENCY_DAYS: Record<string, number> = { weekly: 7, biweekly: 14, monthly: 30 };

const SECTION_LABELS: Record<string, string> = {
  culture: "Culture",
  bounceback: "Guest Bounce Back",
  recovery: "Service Recovery",
  training: "Training & Standards",
  accountability: "Accountability",
  hiring: "Hiring",
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: schedules, error } = await supabase.from("report_schedules").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const due = (schedules ?? []).filter((s) => {
    if (!s.last_sent_at) return true;
    const daysSince = (now - new Date(s.last_sent_at).getTime()) / 86400000;
    return daysSince >= FREQUENCY_DAYS[s.frequency];
  });

  const results: { id: string; sent: boolean; error?: string }[] = [];

  for (const schedule of due) {
    try {
      if (schedule.recipient_emails.length === 0) {
        results.push({ id: schedule.id, sent: false, error: "No recipients" });
        continue;
      }

      const cutoff = new Date(now - FREQUENCY_DAYS[schedule.frequency] * 86400000).toISOString().slice(0, 10);
      const html = await buildReportHtml(supabase, schedule.org_id, schedule.sections, cutoff);

      await sendEmail({
        to: schedule.recipient_emails,
        subject: `Wingman ${schedule.frequency} report`,
        html,
      });

      await supabase.from("report_schedules").update({ last_sent_at: new Date().toISOString() }).eq("id", schedule.id);
      results.push({ id: schedule.id, sent: true });
    } catch (err) {
      results.push({ id: schedule.id, sent: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return NextResponse.json({ checked: schedules?.length ?? 0, due: due.length, results });
}

async function buildReportHtml(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  sections: string[],
  cutoff: string
): Promise<string> {
  const rows: string[] = [];

  if (sections.includes("bounceback")) {
    const { data: guests } = await supabase
      .from("guests")
      .select("id, guest_visits(visit_number, visit_date, location_id)")
      .eq("org_id", orgId);
    const newGuests = ((guests ?? []) as GuestWithVisits[]).filter((g) =>
      g.guest_visits.some((v) => v.visit_number === 1 && v.visit_date && v.visit_date >= cutoff)
    );
    const returned = newGuests.filter((g) => stageOf(g.guest_visits) >= 2).length;
    const pct = newGuests.length > 0 ? Math.round((returned / newGuests.length) * 100) : 0;
    rows.push(row(SECTION_LABELS.bounceback, `${pct}% retention`, `${newGuests.length} new guests, ${returned} returned`));
  }

  if (sections.includes("recovery")) {
    const { data: discounts } = await supabase.from("discounts").select("amount").eq("org_id", orgId).gte("occurred_on", cutoff);
    const total = (discounts ?? []).reduce((s: number, d: { amount: number }) => s + Number(d.amount), 0);
    rows.push(row(SECTION_LABELS.recovery, `$${total.toFixed(0)}`, `${(discounts ?? []).length} discounts logged`));
  }

  if (sections.includes("training")) {
    const { count } = await supabase
      .from("training_signoffs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("occurred_on", cutoff);
    rows.push(row(SECTION_LABELS.training, String(count ?? 0), "sign-offs logged"));
  }

  if (sections.includes("accountability")) {
    const { data: spotChecks } = await supabase.from("spot_checks").select("scores").eq("org_id", orgId).gte("occurred_on", cutoff);
    const avg = spotChecks?.length
      ? spotChecks.reduce(
          (s: number, sc: { scores: number[] }) => s + sc.scores.reduce((a, b) => a + b, 0) / sc.scores.length,
          0
        ) / spotChecks.length
      : 0;
    rows.push(row(SECTION_LABELS.accountability, avg.toFixed(1), "avg spot-check score"));
  }

  if (sections.includes("culture")) {
    const { count } = await supabase
      .from("culture_moments")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("occurred_on", cutoff);
    rows.push(row(SECTION_LABELS.culture, String(count ?? 0), "moments recognized"));
  }

  if (sections.includes("hiring")) {
    const { data: candidates } = await supabase.from("candidates").select("recommendation").eq("org_id", orgId).gte("occurred_on", cutoff);
    const strongFits = (candidates ?? []).filter((c: { recommendation: string }) => c.recommendation === "Strong fit").length;
    rows.push(row(SECTION_LABELS.hiring, String((candidates ?? []).length), `${strongFits} strong fits`));
  }

  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 20px; color: #1a1a1a;">Your Wingman report</h1>
      <p style="font-size: 14px; color: #737373;">Since ${cutoff}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        ${rows.join("")}
      </table>
    </div>
  `;
}

function row(label: string, value: string, detail: string): string {
  return `
    <tr style="border-bottom: 1px solid #e5e5e5;">
      <td style="padding: 12px 0; font-size: 14px; color: #1a1a1a; font-weight: 600;">${label}</td>
      <td style="padding: 12px 0; font-size: 14px; color: #1a1a1a; text-align: right; font-family: monospace;">${value}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding: 0 0 12px 0; font-size: 12px; color: #737373;">${detail}</td>
    </tr>
  `;
}
