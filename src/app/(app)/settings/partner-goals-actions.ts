"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";

export type ActionState = { error: string | null; ok?: boolean };

function toInt(raw: string, fallback: number): number {
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Owner-only. Saves the org-wide default goals plus any per-location overrides.
// A location whose fields are all left blank inherits the default (its override
// row is removed); otherwise its override is upserted (blank fields fall back to
// the default value).
export async function updatePartnerGoals(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the account owner can set goals." };

  const supabase = await createClient();

  const def = {
    goal_new_contacts: toInt(String(formData.get("default_new") || ""), 20),
    goal_events: toInt(String(formData.get("default_events") || ""), 3),
    goal_fundraisers: toInt(String(formData.get("default_fundraisers") || ""), 3),
    goal_active_connections: toInt(String(formData.get("default_active") || ""), 20),
    goal_weekly_reach: toInt(String(formData.get("default_weekly_reach") || ""), 7),
    goal_weekly_visits: toInt(String(formData.get("default_weekly_visits") || ""), 3),
  };

  // Org-wide default row (location_id null). Manual select-then-write since the
  // unique index is partial (PostgREST upsert can't target it reliably).
  {
    const { data: existing } = await supabase.from("partner_goals").select("id").is("location_id", null).maybeSingle();
    if (existing) {
      await supabase.from("partner_goals").update({ ...def, updated_at: new Date().toISOString() }).eq("id", (existing as { id: string }).id);
    } else {
      const { error } = await supabase.from("partner_goals").insert({ org_id: profile.orgId, location_id: null, ...def });
      if (error) return { error: error.message };
    }
  }

  // Per-location overrides.
  const locationIds = formData.getAll("location_id").map(String);
  for (const locId of locationIds) {
    if (!locId) continue;
    const raw = {
      n: String(formData.get(`loc_${locId}_new`) || "").trim(),
      e: String(formData.get(`loc_${locId}_events`) || "").trim(),
      f: String(formData.get(`loc_${locId}_fundraisers`) || "").trim(),
      a: String(formData.get(`loc_${locId}_active`) || "").trim(),
      wr: String(formData.get(`loc_${locId}_weekly_reach`) || "").trim(),
      wv: String(formData.get(`loc_${locId}_weekly_visits`) || "").trim(),
    };
    const allBlank = !raw.n && !raw.e && !raw.f && !raw.a && !raw.wr && !raw.wv;
    const { data: existing } = await supabase
      .from("partner_goals")
      .select("id")
      .eq("location_id", locId)
      .maybeSingle();

    if (allBlank) {
      if (existing) await supabase.from("partner_goals").delete().eq("id", (existing as { id: string }).id);
      continue;
    }
    const row = {
      goal_new_contacts: toInt(raw.n, def.goal_new_contacts),
      goal_events: toInt(raw.e, def.goal_events),
      goal_fundraisers: toInt(raw.f, def.goal_fundraisers),
      goal_active_connections: toInt(raw.a, def.goal_active_connections),
      goal_weekly_reach: toInt(raw.wr, def.goal_weekly_reach),
      goal_weekly_visits: toInt(raw.wv, def.goal_weekly_visits),
    };
    if (existing) {
      await supabase.from("partner_goals").update({ ...row, updated_at: new Date().toISOString() }).eq("id", (existing as { id: string }).id);
    } else {
      const { error } = await supabase.from("partner_goals").insert({ org_id: profile.orgId, location_id: locId, ...row });
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/settings");
  revalidatePath("/partners");
  return { error: null, ok: true };
}

// Clean a free-text recipient list into a stored "a@x.com, b@y.com" string.
function cleanEmails(raw: string): string {
  return raw
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    .slice(0, 25)
    .join(", ")
    .slice(0, 800);
}

// Owner-only. Saves the whole Partners report config: cadence (off/weekly/
// monthly), the weekly send day, combined-vs-per-location delivery, and the
// recipient list (owners always get it too).
export async function updatePartnersReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the account owner can change this." };

  const freq = String(formData.get("frequency") || "off");
  const frequency = ["off", "weekly", "monthly"].includes(freq) ? freq : "off";
  const dayN = parseInt(String(formData.get("day") || "1"), 10);
  const day = Number.isFinite(dayN) && dayN >= 0 && dayN <= 6 ? dayN : 1;
  const modeRaw = String(formData.get("mode") || "combined");
  const mode = modeRaw === "per_location" ? "per_location" : "combined";
  const emails = cleanEmails(String(formData.get("emails") || ""));

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ partners_report_frequency: frequency, partners_report_day: day, partners_report_mode: mode, partners_report_emails: emails })
    .eq("id", profile.orgId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null, ok: true };
}

// Owner-only. Sends the report right now to the owner's own inbox so they can
// see exactly what goes out, without waiting for the schedule or emailing the
// whole recipient list.
export async function sendPartnersReportTestNow(): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the account owner can do this." };
  if (!profile.email) return { error: "Your account has no email on file." };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { computePartnerReport, combinedReportHtml, locationReportHtml } = await import("@/lib/partner-report");
  const { sendEmail } = await import("@/lib/email");

  const admin = createAdminClient();
  const { data: orgRow } = await admin.from("organizations").select("name, partners_report_frequency, partners_report_mode").eq("id", profile.orgId).maybeSingle();
  const org = orgRow as { name: string; partners_report_frequency: string; partners_report_mode: string } | null;
  const weekly = org?.partners_report_frequency !== "monthly";
  const periodLabel = `Test · ${weekly ? "this week" : "this month"}`;
  const sinceIso = new Date(Date.now() - (weekly ? 7 : 31) * 24 * 3600000).toISOString();
  const report = await computePartnerReport(admin, profile.orgId, org?.name ?? "Your org", sinceIso, Date.now());
  if (report.locations.length === 0) return { error: "No locations to report on yet." };

  try {
    if (org?.partners_report_mode === "per_location") {
      // Test send: just the first location as a sample, to the owner only.
      const m = report.locations[0];
      await sendEmail({ to: [profile.email], subject: `[Test] ${report.orgName} — Partners report: ${m.name}`, html: locationReportHtml(report, m, periodLabel) });
    } else {
      await sendEmail({ to: [profile.email], subject: `[Test] ${report.orgName}: Partners report`, html: combinedReportHtml(report, periodLabel) });
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  return { error: null, ok: true };
}

// Owner-only. Add a hand-off target (a manager or department a contact can be
// handed to). location_id empty = company-wide; otherwise scoped to that store.
export async function addHandoffTarget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the account owner can edit hand-off targets." };

  const label = String(formData.get("label") || "").trim().slice(0, 120);
  if (!label) return { error: "Enter a name or department." };
  const locationId = String(formData.get("location_id") || "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_handoff_targets")
    .insert({ org_id: profile.orgId, location_id: locationId, label });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/partners");
  return { error: null, ok: true };
}

// Owner-only. Remove a hand-off target by id.
export async function removeHandoffTarget(id: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.accessRole !== "super_admin") return { error: "Only the account owner can edit hand-off targets." };

  const supabase = await createClient();
  const { error } = await supabase.from("partner_handoff_targets").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/partners");
  return { error: null, ok: true };
}
