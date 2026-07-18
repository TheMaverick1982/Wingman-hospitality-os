import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { aiCostUsd } from "@/lib/ai/usage";

// The capacity watchdog. runCapacityCheck() measures how close we are to the
// limits of the services Wingman depends on (Supabase storage, Resend + Twilio
// monthly volume, AI spend, and the CRM cron's throughput) and emails the owner
// when a metric crosses a warn (70%) or critical (90%) threshold — once per
// metric+level per 30 days, so an ongoing breach doesn't nag daily.
//
// Limits default to today's plan tiers and are overridable by env as you upgrade.
// Everything here is best-effort and never throws into the caller.

type Admin = ReturnType<typeof createAdminClient>;

const ALERT_TO = process.env.MONITOR_ALERT_EMAIL ?? "brian@brianhardy.com";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

const WARN = 0.7;
const CRIT = 0.9;

function envNum(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Plan limits. Override any of these in Vercel env as your tiers change.
const LIMITS = {
  dbBytes: envNum(process.env.CAP_DB_BYTES, 8 * 1024 ** 3), // Supabase Pro: 8 GB included
  emailMonthly: envNum(process.env.CAP_EMAIL_MONTHLY, 50_000), // Resend Pro: 50k/mo
  smsMonthly: envNum(process.env.CAP_SMS_MONTHLY, 5_000), // your Twilio budget
  aiSpendMonthly: envNum(process.env.CAP_AI_SPEND_USD, 500), // your Anthropic budget ($)
  activeOrgs: envNum(process.env.CAP_ACTIVE_ORGS, 0), // Supabase MAU-ish; 0 = skip
  cronBacklog: envNum(process.env.CAP_CRON_BACKLOG, 120), // one crm-sequences run's worth
};

export type Metric = {
  metric: string;
  label: string;
  value: number;
  limit: number;
  ratio: number;
  level: "ok" | "warn" | "critical";
  display: string; // human-readable "value / limit"
};

function levelFor(ratio: number): "ok" | "warn" | "critical" {
  if (ratio >= CRIT) return "critical";
  if (ratio >= WARN) return "warn";
  return "ok";
}

function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function mk(metric: string, label: string, value: number, limit: number, display: string): Metric {
  const ratio = limit > 0 ? value / limit : 0;
  return { metric, label, value, limit, ratio, level: levelFor(ratio), display };
}

async function measure(admin: Admin): Promise<Metric[]> {
  const monthStart = monthStartIso();
  const nowIso = new Date().toISOString();
  const metrics: Metric[] = [];

  // 1. Database size (Supabase storage tier).
  try {
    const { data } = await admin.rpc("db_size_bytes");
    const bytes = Number(data ?? 0);
    if (bytes > 0) metrics.push(mk("db_size", "Database size", bytes, LIMITS.dbBytes, `${fmtBytes(bytes)} / ${fmtBytes(LIMITS.dbBytes)}`));
  } catch (e) {
    console.error("[capacity] db_size failed", e);
  }

  // 2 & 3. Email + SMS volume month-to-date (Resend / Twilio caps).
  try {
    const { data } = await admin.from("provider_usage_daily").select("channel, count").gte("day", monthStart.slice(0, 10));
    const rows = (data ?? []) as { channel: string; count: number }[];
    const email = rows.filter((r) => r.channel === "email").reduce((s, r) => s + (r.count ?? 0), 0);
    const sms = rows.filter((r) => r.channel === "sms").reduce((s, r) => s + (r.count ?? 0), 0);
    metrics.push(mk("email_mtd", "Emails this month", email, LIMITS.emailMonthly, `${email.toLocaleString()} / ${LIMITS.emailMonthly.toLocaleString()}`));
    metrics.push(mk("sms_mtd", "Texts this month", sms, LIMITS.smsMonthly, `${sms.toLocaleString()} / ${LIMITS.smsMonthly.toLocaleString()}`));
  } catch (e) {
    console.error("[capacity] provider_usage failed", e);
  }

  // 4. AI spend month-to-date (Anthropic budget).
  try {
    const { data } = await admin.from("ai_usage_events").select("model, input_tokens, output_tokens").gte("created_at", monthStart);
    const rows = (data ?? []) as { model: string; input_tokens: number; output_tokens: number }[];
    const spend = rows.reduce((s, r) => s + aiCostUsd(r.model, r.input_tokens ?? 0, r.output_tokens ?? 0), 0);
    metrics.push(mk("ai_spend_mtd", "AI spend this month", spend, LIMITS.aiSpendMonthly, `$${spend.toFixed(2)} / $${LIMITS.aiSpendMonthly.toLocaleString()}`));
  } catch (e) {
    console.error("[capacity] ai_spend failed", e);
  }

  // 5. CRM cron backlog — due enrollments waiting on the hourly run (ceiling 120).
  try {
    const { count } = await admin
      .from("crm_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lte("next_run_at", nowIso);
    const backlog = count ?? 0;
    metrics.push(mk("cron_backlog", "CRM sequence backlog", backlog, LIMITS.cronBacklog, `${backlog.toLocaleString()} due / ${LIMITS.cronBacklog.toLocaleString()} per run`));
  } catch (e) {
    console.error("[capacity] cron_backlog failed", e);
  }

  // 6. Active orgs (optional — only when a MAU-style cap is configured).
  if (LIMITS.activeOrgs > 0) {
    try {
      const { count } = await admin
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .neq("system_generated", true);
      const orgs = count ?? 0;
      metrics.push(mk("active_orgs", "Active organizations", orgs, LIMITS.activeOrgs, `${orgs.toLocaleString()} / ${LIMITS.activeOrgs.toLocaleString()}`));
    } catch (e) {
      console.error("[capacity] active_orgs failed", e);
    }
  }

  return metrics;
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

async function sendAlert(breaches: Metric[], fresh: Metric[]): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const worst = breaches.some((b) => b.level === "critical") ? "critical" : "warn";
  const row = (m: Metric) => {
    const pct = Math.round(m.ratio * 100);
    const color = m.level === "critical" ? "#b91c1c" : "#b45309";
    const isNew = fresh.some((f) => f.metric === m.metric && f.level === m.level);
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;">${esc(m.label)}${isNew ? ' <span style="color:#0a6cff;font-size:11px;font-weight:700;">NEW</span>' : ""}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;">${esc(m.display)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;font-weight:700;color:${color};">${pct}% · ${m.level.toUpperCase()}</td>
    </tr>`;
  };
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;max-width:640px;">
    <p style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${worst === "critical" ? "#b91c1c" : "#b45309"};margin:0 0 6px;">Capacity ${worst === "critical" ? "critical" : "warning"}</p>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;">Time to look at upgrading a service</h1>
    <p style="font-size:13.5px;color:#525252;margin:0 0 16px;">One or more services Wingman relies on is approaching its plan limit. Review and upgrade before it affects customers.</p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
      <thead><tr style="text-align:left;background:#fafafa;">
        <th style="padding:8px 12px;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#737373;">Service</th>
        <th style="padding:8px 12px;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#737373;">Usage</th>
        <th style="padding:8px 12px;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#737373;">Level</th>
      </tr></thead>
      <tbody>${breaches.map(row).join("")}</tbody>
    </table>
    <p style="font-size:12.5px;color:#999;margin:0 0 4px;"><a href="${SITE}/admin/health" style="color:#0a6cff;">Open the Health dashboard →</a></p>
    <p style="font-size:12.5px;color:#999;margin:0;">Thresholds: warn at 70%, critical at 90% of each plan limit. Tune limits via the CAP_* env vars. You won't get another email for the same item for 30 days.</p>
  </div>`;
  try {
    await sendEmail({ to: [ALERT_TO], subject: `${worst === "critical" ? "🚨" : "⚠️"} Wingman capacity: ${breaches.map((b) => b.label).join(", ").slice(0, 90)}`, html });
  } catch (e) {
    console.error("[capacity] alert email failed", e);
  }
}

export type CapacityResult = { metrics: Metric[]; breaches: number; alerted: number };

export async function runCapacityCheck(): Promise<CapacityResult> {
  const admin = createAdminClient();
  const metrics = await measure(admin);
  const breaches = metrics.filter((m) => m.level !== "ok");
  if (breaches.length === 0) return { metrics, breaches: 0, alerted: 0 };

  // Dedupe: only alert a metric+level that hasn't fired in the last 30 days.
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const fresh: Metric[] = [];
  for (const b of breaches) {
    try {
      const { data } = await admin
        .from("capacity_alerts")
        .select("id")
        .eq("metric", b.metric)
        .eq("level", b.level)
        .gte("created_at", cutoff)
        .limit(1);
      if (!(data ?? []).length) fresh.push(b);
    } catch (e) {
      console.error("[capacity] dedupe check failed", e);
    }
  }

  if (fresh.length > 0) {
    await sendAlert(breaches, fresh);
    for (const b of fresh) {
      try {
        await admin.from("capacity_alerts").insert({ metric: b.metric, level: b.level, value: b.value, threshold: b.limit, message: `${b.label}: ${b.display}` });
      } catch (e) {
        console.error("[capacity] alert insert failed", e);
      }
    }
  }

  return { metrics, breaches: breaches.length, alerted: fresh.length };
}
