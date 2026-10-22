import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_GOALS, resolveGoal, type PartnerGoal } from "@/lib/partners";

// Shared metrics + HTML for the Partners weekly/monthly report, so the cron and
// the "send a test now" button produce identical emails. The report is itemized
// per location and pulled from what the team logged: who they talked to, who
// they emailed, where they visited, contacts reached (vs goal), and the bookings
// they landed (date / group / headcount). Plus accountability extras: revenue
// booked, who logged what, and who's gone cold.

type Admin = ReturnType<typeof createAdminClient>;

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
function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type ContactLine = { company: string; contact: string; phone: string; email: string };
type Booking = { company: string; kind: string; eventDate: string | null; headcount: number | null };

export type LocationMetrics = {
  locationId: string;
  name: string;
  talkedTo: ContactLine[];
  emailed: ContactLine[];
  visited: ContactLine[];
  reachedCount: number;
  visitCount: number;
  bookings: Booking[];
  revenueCents: number;
  touchesByPerson: { name: string; count: number }[];
  handoffs: { company: string; to: string; by: string }[];
  fadingCount: number;
  fadingTop: { company: string; contact: string; days: number | null }[];
  goal: typeof DEFAULT_GOALS;
};

export type PartnerReport = { orgName: string; locations: LocationMetrics[] };

type Contact = { id: string; location_id: string | null; company_name: string; contact_name: string; phone: string; email: string; last_activity_at: string | null };
type Activity = { contact_id: string; location_id: string | null; activity_type: string; activity_date: string; revenue_cents: number | null; event_date: string | null; headcount: number | null; set_handoff: string | null; created_by: string | null };

const REACH_TYPES = new Set(["call_text", "email", "meeting", "visit", "in_store_guest"]);

// Compute the per-location report for an org over the trailing period starting at
// `sinceIso` (e.g. last 7 days for weekly).
export async function computePartnerReport(admin: Admin, orgId: string, orgName: string, sinceIso: string, todayMs: number): Promise<PartnerReport> {
  const since = sinceIso.slice(0, 10);

  const [{ data: locRows }, { data: contactRows }, { data: activityRows }, { data: goalRows }, { data: profileRows }] = await Promise.all([
    admin.from("locations").select("id, name").eq("org_id", orgId).order("name"),
    admin.from("partner_contacts").select("id, location_id, company_name, contact_name, phone, email, last_activity_at").eq("org_id", orgId),
    admin.from("partner_activities").select("contact_id, location_id, activity_type, activity_date, revenue_cents, event_date, headcount, set_handoff, created_by").eq("org_id", orgId).gte("activity_date", since),
    admin.from("partner_goals").select("location_id, goal_new_contacts, goal_events, goal_fundraisers, goal_active_connections, goal_weekly_reach, goal_weekly_visits").eq("org_id", orgId),
    admin.from("profiles").select("id, full_name").eq("org_id", orgId),
  ]);

  const locations = (locRows ?? []) as { id: string; name: string }[];
  const contacts = (contactRows ?? []) as Contact[];
  const activities = (activityRows ?? []) as Activity[];
  const goals = (goalRows ?? []) as PartnerGoal[];
  const orgDefaultGoal = goals.find((g) => g.location_id === null) ?? null;
  const goalByLoc = new Map(goals.filter((g) => g.location_id).map((g) => [g.location_id as string, g]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const nameById = new Map(((profileRows ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  const line = (c: Contact): ContactLine => ({ company: c.company_name, contact: c.contact_name, phone: c.phone, email: c.email });

  const byLoc = new Map<string, LocationMetrics>();
  const reached = new Map<string, Set<string>>(); // loc -> contact ids reached
  const talkedSeen = new Map<string, Set<string>>();
  const emailSeen = new Map<string, Set<string>>();
  const visitSeen = new Map<string, Set<string>>();
  const loggers = new Map<string, Map<string, number>>();
  for (const l of locations) {
    byLoc.set(l.id, {
      locationId: l.id, name: l.name, talkedTo: [], emailed: [], visited: [], reachedCount: 0, visitCount: 0,
      bookings: [], revenueCents: 0, touchesByPerson: [], handoffs: [], fadingCount: 0, fadingTop: [],
      goal: resolveGoal(goalByLoc, orgDefaultGoal, l.id),
    });
    reached.set(l.id, new Set()); talkedSeen.set(l.id, new Set()); emailSeen.set(l.id, new Set()); visitSeen.set(l.id, new Set()); loggers.set(l.id, new Map());
  }

  for (const a of activities) {
    const locId = a.location_id;
    const m = locId ? byLoc.get(locId) : null;
    if (!m || !locId) continue;
    const c = contactById.get(a.contact_id);
    if (a.activity_type !== "note" && REACH_TYPES.has(a.activity_type)) {
      reached.get(locId)!.add(a.contact_id);
      if (a.created_by) {
        const lm = loggers.get(locId)!;
        const nm = nameById.get(a.created_by) ?? "Someone";
        lm.set(nm, (lm.get(nm) ?? 0) + 1);
      }
    }
    if (c && a.activity_type === "call_text" && !talkedSeen.get(locId)!.has(a.contact_id)) { talkedSeen.get(locId)!.add(a.contact_id); m.talkedTo.push(line(c)); }
    if (c && a.activity_type === "email" && !emailSeen.get(locId)!.has(a.contact_id)) { emailSeen.get(locId)!.add(a.contact_id); m.emailed.push(line(c)); }
    if (c && a.activity_type === "visit" && !visitSeen.get(locId)!.has(a.contact_id)) { visitSeen.get(locId)!.add(a.contact_id); m.visited.push(line(c)); m.visitCount++; }
    if (a.activity_type === "event_booked" || a.activity_type === "fundraiser_booked") {
      m.bookings.push({ company: c?.company_name ?? "—", kind: a.activity_type === "event_booked" ? "Event" : "Fundraiser", eventDate: a.event_date, headcount: a.headcount });
    }
    // A hand-off recorded on this touch (who a lead was passed to) — the
    // accountability signal: how many handed off this period, and to whom.
    if (a.set_handoff && a.set_handoff.trim()) {
      m.handoffs.push({ company: c?.company_name ?? "—", to: a.set_handoff.trim(), by: a.created_by ? (nameById.get(a.created_by) ?? "Someone") : "Someone" });
    }
    if (a.revenue_cents) m.revenueCents += a.revenue_cents;
  }

  // Fading snapshot (current, not period-bound).
  const fadingByLoc = new Map<string, Contact[]>();
  for (const c of contacts) {
    if (!c.location_id || !byLoc.has(c.location_id)) continue;
    const ds = daysSince(c.last_activity_at, todayMs);
    if (ds === null || ds >= 30) {
      const list = fadingByLoc.get(c.location_id) ?? [];
      list.push(c);
      fadingByLoc.set(c.location_id, list);
    }
  }

  for (const m of byLoc.values()) {
    m.reachedCount = reached.get(m.locationId)!.size;
    m.touchesByPerson = [...loggers.get(m.locationId)!.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
    const fading = fadingByLoc.get(m.locationId) ?? [];
    m.fadingCount = fading.length;
    m.fadingTop = fading.map((c) => ({ company: c.company_name, contact: c.contact_name, days: daysSince(c.last_activity_at, todayMs) })).sort((a, b) => (b.days ?? 1e9) - (a.days ?? 1e9)).slice(0, 8);
  }

  return { orgName, locations: [...byLoc.values()] };
}

function contactListHtml(label: string, lines: ContactLine[]): string {
  if (lines.length === 0) return `<div style="font-size:13px;color:#999;margin-top:8px;"><strong style="color:#555;">${esc(label)}:</strong> none logged</div>`;
  const items = lines
    .map((c) => {
      const who = [c.company, c.contact].filter(Boolean).map(esc).join(" — ");
      const reach = c.phone || c.email;
      return `<li style="font-size:13px;color:#333;margin:2px 0;">${who}${reach ? ` <span style="color:#888;">· ${esc(reach)}</span>` : ""}</li>`;
    })
    .join("");
  return `<div style="margin-top:8px;"><strong style="font-size:13px;color:#555;">${esc(label)} (${lines.length}):</strong><ul style="margin:3px 0 0;padding-left:18px;">${items}</ul></div>`;
}

function sectionHtml(m: LocationMetrics): string {
  const reachHit = m.reachedCount >= m.goal.goal_weekly_reach;
  const visitHit = m.visitCount >= m.goal.goal_weekly_visits;
  const byPerson = m.touchesByPerson.length ? m.touchesByPerson.map((p) => `${esc(p.name)} ${p.count}`).join(" · ") : "—";
  const bookings = m.bookings.length
    ? `<ul style="margin:3px 0 0;padding-left:18px;">${m.bookings
        .map((b) => `<li style="font-size:13px;color:#333;margin:2px 0;">${esc(b.company)} — ${esc(b.kind)}${b.eventDate ? ` · ${fmtDate(b.eventDate)}` : ""}${b.headcount ? ` · ${b.headcount} guests` : ""}</li>`)
        .join("")}</ul>`
    : `<div style="font-size:13px;color:#999;margin-top:3px;">none this period</div>`;
  const hits = m.fadingTop.length
    ? `<ul style="margin:3px 0 0;padding-left:18px;">${m.fadingTop.map((c) => `<li style="font-size:13px;color:#333;margin:2px 0;">${esc(c.company)}${c.contact ? ` — ${esc(c.contact)}` : ""} <span style="color:#B45309;">(${c.days === null ? "never" : `${c.days}d quiet`})</span></li>`).join("")}</ul>`
    : `<div style="font-size:13px;color:#15803D;margin-top:3px;">Nobody's fading — nice work.</div>`;

  // Hand-offs this period: total, a who-got-what breakdown, and the list.
  const handoffBlock = (() => {
    if (!m.handoffs.length) return `<div style="font-size:13px;color:#999;margin-top:10px;"><strong style="color:#555;">Hand-offs:</strong> none this period</div>`;
    const byTarget = new Map<string, number>();
    for (const h of m.handoffs) byTarget.set(h.to, (byTarget.get(h.to) ?? 0) + 1);
    const summary = [...byTarget.entries()].sort((a, b) => b[1] - a[1]).map(([to, n]) => `${esc(to)} ${n}`).join(" · ");
    const items = m.handoffs
      .map((h) => `<li style="font-size:13px;color:#333;margin:2px 0;">${esc(h.company)} → <strong>${esc(h.to)}</strong>${h.by ? ` <span style="color:#888;">(by ${esc(h.by)})</span>` : ""}</li>`)
      .join("");
    return `<div style="margin-top:10px;"><strong style="font-size:13px;color:#555;">Hand-offs (${m.handoffs.length}):</strong> <span style="font-size:13px;color:#333;">${summary}</span><ul style="margin:3px 0 0;padding-left:18px;">${items}</ul></div>`;
  })();

  return `<div style="margin-top:20px;">
    <p style="font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#b45309;font-weight:700;margin:0 0 8px;">${esc(m.name)}</p>
    <div style="font-size:14px;color:#1a1a1a;margin-bottom:4px;">
      Contacts reached <strong>${m.reachedCount}</strong> / ${m.goal.goal_weekly_reach} ${reachHit ? "✅" : ""} &nbsp;·&nbsp; Visits <strong>${m.visitCount}</strong> / ${m.goal.goal_weekly_visits} ${visitHit ? "✅" : ""}
    </div>
    ${contactListHtml("Talked to", m.talkedTo)}
    ${contactListHtml("Emailed", m.emailed)}
    ${contactListHtml("Visited", m.visited)}
    <div style="margin-top:10px;"><strong style="font-size:13px;color:#555;">Bookings:</strong>${bookings}</div>
    ${handoffBlock}
    <div style="font-size:13px;color:#333;margin-top:10px;"><strong>${money(m.revenueCents)}</strong> revenue booked · logged by: ${byPerson}</div>
    <div style="font-size:13px;font-weight:600;color:#B45309;margin-top:10px;">Needs follow-up (${m.fadingCount}):</div>
    ${hits}
  </div>`;
}

function wrap(orgName: string, periodLabel: string, subLine: string, blocks: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:620px;margin:0 auto;">
    <p style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#b45309;font-weight:600;margin:0 0 4px;">${esc(periodLabel)}</p>
    <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 2px;">${esc(orgName)} — Partners report</h1>
    <p style="font-size:12.5px;color:#888;margin:0 0 4px;">${esc(subLine)}</p>
    ${blocks}
    <p style="margin-top:22px;"><a href="${SITE}/partners" style="background:#B3412C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Open Partners</a></p>
    <p style="font-size:12px;color:#aaa;margin-top:20px;border-top:1px solid #eee;padding-top:12px;">You're getting this because the Partners report is on. An owner can change the cadence, delivery, recipients, or goals under Settings → Partners.</p>
  </div>`;
}

export function combinedReportHtml(report: PartnerReport, periodLabel: string): string {
  return wrap(report.orgName, periodLabel, `All locations · ${periodLabel.toLowerCase()}`, report.locations.map(sectionHtml).join("\n"));
}

export function locationReportHtml(report: PartnerReport, m: LocationMetrics, periodLabel: string): string {
  return wrap(report.orgName, periodLabel, `${m.name} · ${periodLabel.toLowerCase()}`, sectionHtml(m));
}
