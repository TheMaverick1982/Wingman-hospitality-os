import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isNotificationEnabled } from "@/lib/notifications";
import { DEFAULT_GOALS, resolveGoal, quarterStart, type PartnerGoal } from "@/lib/partners";

// Monthly Partners report. Runs hourly on the 1st and, for each org, fires once
// when it's 8am on the 1st in that org's local timezone (its first location's
// tz). Sends TWO kinds of email:
//   • Leadership rollup → owner(s) + partners_report_email: every store's goal
//     progress, revenue, and fading count, laggards first.
//   • Per-manager report → each manager, their store(s) only: metrics + a
//     "hit list" of fading/never-touched contacts to call this week.
// Empty stores still get a report (a coaching nudge), per product decision.
export const maxDuration = 300;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}
function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}
function daysSince(dateStr: string | null, todayMs: number): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return Math.floor((todayMs - new Date(y, m - 1, d).getTime()) / 86400000);
}

// Local {hour, day, month} for a timezone, from the current instant.
function localParts(tz: string): { hour: number; day: number; ym: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "numeric", hour12: false, day: "numeric", month: "2-digit", year: "numeric",
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const hour = parseInt(get("hour"), 10) % 24;
    return { hour, day: parseInt(get("day"), 10), ym: `${get("year")}-${get("month")}` };
  } catch {
    return { hour: -1, day: -1, ym: "" };
  }
}

type Contact = { id: string; location_id: string | null; company_name: string; contact_name: string; last_activity_at: string | null; created_at: string };
type Activity = { location_id: string | null; activity_type: string; activity_date: string; revenue_cents: number | null };

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const todayMs = Date.now();

  // Orgs that have any Partners contacts — no point reporting on empty modules.
  const { data: orgIdsRows } = await admin.from("partner_contacts").select("org_id");
  const orgIds = [...new Set(((orgIdsRows ?? []) as { org_id: string }[]).map((r) => r.org_id))];
  if (orgIds.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;
  for (const orgId of orgIds) {
    const { data: orgRow } = await admin
      .from("organizations")
      .select("id, name, partners_report_email, partners_report_month, notification_settings")
      .eq("id", orgId)
      .maybeSingle();
    if (!orgRow) continue;
    const org = orgRow as { name: string; partners_report_email: string | null; partners_report_month: string | null; notification_settings: Record<string, boolean> | null };
    if (!isNotificationEnabled(org.notification_settings, "partner_monthly_report")) continue;

    const { data: locRows } = await admin.from("locations").select("id, name, timezone").eq("org_id", orgId).order("name");
    const locations = (locRows ?? []) as { id: string; name: string; timezone: string }[];
    if (locations.length === 0) continue;

    // Fire once/month, at 8am on the 1st in the org's primary-location timezone.
    const tz = locations[0].timezone || "America/New_York";
    const { hour, day, ym } = localParts(tz);
    if (day !== 1 || hour !== 8) continue;
    if (org.partners_report_month === ym) continue; // already sent this month

    const [{ data: contactRows }, { data: activityRows }, { data: goalRows }, { data: profileRows }, { data: plRows }] = await Promise.all([
      admin.from("partner_contacts").select("id, location_id, company_name, contact_name, last_activity_at, created_at").eq("org_id", orgId),
      admin.from("partner_activities").select("location_id, activity_type, activity_date, revenue_cents").eq("org_id", orgId),
      admin.from("partner_goals").select("location_id, goal_new_contacts, goal_events, goal_fundraisers, goal_active_connections").eq("org_id", orgId),
      admin.from("profiles").select("id, full_name, access_role, location_id, all_locations").eq("org_id", orgId),
      admin.from("profile_locations").select("profile_id, location_id"),
    ]);

    const contacts = (contactRows ?? []) as Contact[];
    const activities = (activityRows ?? []) as Activity[];
    const goals = (goalRows ?? []) as PartnerGoal[];
    const orgDefaultGoal = goals.find((g) => g.location_id === null) ?? null;
    const goalByLoc = new Map(goals.filter((g) => g.location_id).map((g) => [g.location_id as string, g]));
    const qStart = quarterStart(new Date(todayMs).toISOString().slice(0, 10));

    // Per-location metrics.
    type Metrics = { name: string; newContacts: number; events: number; fundraisers: number; revenue: number; active: number; fading: Contact[]; goal: typeof DEFAULT_GOALS };
    const metricsByLoc = new Map<string, Metrics>();
    for (const l of locations) {
      metricsByLoc.set(l.id, { name: l.name, newContacts: 0, events: 0, fundraisers: 0, revenue: 0, active: 0, fading: [], goal: resolveGoal(goalByLoc, orgDefaultGoal, l.id) });
    }
    for (const c of contacts) {
      const m = c.location_id ? metricsByLoc.get(c.location_id) : null;
      if (!m) continue;
      if (c.created_at.slice(0, 10) >= qStart) m.newContacts++;
      const ds = daysSince(c.last_activity_at, todayMs);
      if (ds !== null && ds < 30) m.active++;
      if (ds === null || ds >= 30) m.fading.push(c);
    }
    for (const a of activities) {
      const m = a.location_id ? metricsByLoc.get(a.location_id) : null;
      if (!m || a.activity_date < qStart) continue;
      if (a.activity_type === "event_booked") m.events++;
      if (a.activity_type === "fundraiser_booked") m.fundraisers++;
      if (a.revenue_cents) m.revenue += a.revenue_cents;
    }

    // --- Leadership rollup (owners + report email), laggards first ----------
    const owners = (profileRows ?? []).filter((p) => (p as { access_role: string }).access_role === "super_admin");
    const ownerEmails: string[] = [];
    for (const o of owners) {
      try {
        const { data: u } = await admin.auth.admin.getUserById((o as { id: string }).id);
        if (u?.user?.email) ownerEmails.push(u.user.email);
      } catch { /* skip */ }
    }
    if (org.partners_report_email) ownerEmails.push(org.partners_report_email);
    const rollupTo = [...new Set(ownerEmails.map((e) => e.toLowerCase()))];

    const ranked = [...metricsByLoc.values()].sort((a, b) => b.fading.length - a.fading.length);
    const rollupRows = ranked
      .map((m) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;">${esc(m.name)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:center;">${m.newContacts}/${m.goal.goal_new_contacts}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:center;">${m.events}/${m.goal.goal_events}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:center;">${m.fundraisers}/${m.goal.goal_fundraisers}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:center;color:#B45309;">${m.fading.length}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${money(m.revenue)}</td>
      </tr>`)
      .join("");
    if (rollupTo.length) {
      const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;">
        <h2 style="font-size:19px;color:#1a1a1a;">${esc(org.name)} — Partners monthly report</h2>
        <p style="font-size:14px;color:#555;">Community relationship progress across all stores this quarter.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead><tr style="background:#FAFAFA;">
            <th style="padding:6px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#888;">Store</th>
            <th style="padding:6px 8px;font-size:11px;text-transform:uppercase;color:#888;">New</th>
            <th style="padding:6px 8px;font-size:11px;text-transform:uppercase;color:#888;">Events</th>
            <th style="padding:6px 8px;font-size:11px;text-transform:uppercase;color:#888;">Fundraisers</th>
            <th style="padding:6px 8px;font-size:11px;text-transform:uppercase;color:#888;">Fading</th>
            <th style="padding:6px 8px;font-size:11px;text-transform:uppercase;color:#888;text-align:right;">Revenue</th>
          </tr></thead>
          <tbody>${rollupRows}</tbody>
        </table>
        <p style="margin-top:20px;"><a href="${SITE}/partners" style="background:#B3412C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Open Partners</a></p>
      </div>`;
      try {
        await sendEmail({ to: rollupTo, subject: `${org.name}: Partners monthly report`, html });
        sent++;
      } catch (err) { console.error("partner rollup email failed", err); }
    }

    // --- Per-manager reports (their stores + hit list) ---------------------
    const managers = (profileRows ?? []).filter((p) => (p as { access_role: string }).access_role === "manager");
    const extraLocs = new Map<string, string[]>();
    for (const r of (plRows ?? []) as { profile_id: string; location_id: string }[]) {
      const list = extraLocs.get(r.profile_id) ?? [];
      list.push(r.location_id);
      extraLocs.set(r.profile_id, list);
    }
    for (const mgr of managers) {
      const mp = mgr as { id: string; full_name: string; location_id: string | null; all_locations: boolean };
      const locIds = mp.all_locations ? locations.map((l) => l.id) : [...new Set([mp.location_id, ...(extraLocs.get(mp.id) ?? [])].filter(Boolean) as string[])];
      if (locIds.length === 0) continue;
      let email = "";
      try {
        const { data: u } = await admin.auth.admin.getUserById(mp.id);
        email = u?.user?.email ?? "";
      } catch { /* skip */ }
      if (!email) continue;

      const blocks = locIds
        .map((lid) => metricsByLoc.get(lid))
        .filter((m): m is Metrics => !!m)
        .map((m) => {
          const hits = m.fading
            .sort((a, b) => (daysSince(a.last_activity_at, todayMs) ?? 1e9) < (daysSince(b.last_activity_at, todayMs) ?? 1e9) ? 1 : -1)
            .slice(0, 10)
            .map((c) => {
              const ds = daysSince(c.last_activity_at, todayMs);
              return `<li style="font-size:13px;color:#333;margin:2px 0;">${esc(c.company_name)}${c.contact_name ? ` — ${esc(c.contact_name)}` : ""} <span style="color:#B45309;">(${ds === null ? "never contacted" : `${ds}d quiet`})</span></li>`;
            })
            .join("");
          return `<div style="margin-top:16px;">
            <div style="font-size:15px;font-weight:600;color:#1a1a1a;">${esc(m.name)}</div>
            <div style="font-size:13px;color:#555;margin:4px 0;">New contacts ${m.newContacts}/${m.goal.goal_new_contacts} · Events ${m.events}/${m.goal.goal_events} · Fundraisers ${m.fundraisers}/${m.goal.goal_fundraisers} · Revenue ${money(m.revenue)}</div>
            <div style="font-size:13px;font-weight:600;color:#B45309;margin-top:6px;">Hit list — reach out this week (${m.fading.length}):</div>
            <ul style="margin:4px 0 0 0;padding-left:18px;">${hits || '<li style="font-size:13px;color:#15803D;list-style:none;margin-left:-18px;">Nobody&apos;s fading — nice work.</li>'}</ul>
          </div>`;
        })
        .join("");

      const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="font-size:18px;color:#1a1a1a;">Your Partners report</h2>
        <p style="font-size:14px;color:#555;">${esc(mp.full_name || "Hi")} — here's where your community relationships stand, and who to call this week.</p>
        ${blocks}
        <p style="margin-top:20px;"><a href="${SITE}/partners" style="background:#B3412C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Open Partners</a></p>
      </div>`;
      try {
        await sendEmail({ to: [email], subject: "Your Partners report + follow-up hit list", html });
        sent++;
      } catch (err) { console.error("partner manager email failed", err); }
    }

    await admin.from("organizations").update({ partners_report_month: ym }).eq("id", orgId);
  }

  return NextResponse.json({ ok: true, sent });
}
