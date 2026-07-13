import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isNotificationEnabled } from "@/lib/notifications";

export const maxDuration = 60;

const FALLBACK_ALERT = process.env.MONITOR_ALERT_EMAIL ?? "brian@brianhardy.com";

// Runs daily. Finds test assignments whose deadline has passed and that still
// aren't complete (not passed, not locked), and emails the manager on file for
// the location the test was taken for — once per assignment — so they can follow
// up and coach. "Locked" already has its own alert, so it's excluded here.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await admin
    .from("test_assignments")
    .select("id, org_id, location_id, due_at, status, last_score, staff_members(full_name), tests(title)")
    .in("status", ["assigned", "in_progress"])
    .eq("due_alerted", false)
    .not("due_at", "is", null)
    .lte("due_at", nowIso)
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cache location email lookups and each org's "test_overdue" preference.
  const locEmail = new Map<string, { to: string; name: string }>();
  const orgOn = new Map<string, boolean>();
  async function overdueOn(orgId: string): Promise<boolean> {
    if (!orgOn.has(orgId)) {
      const { data: o } = await admin.from("organizations").select("notification_settings").eq("id", orgId).maybeSingle();
      orgOn.set(orgId, isNotificationEnabled((o as { notification_settings?: Record<string, boolean> } | null)?.notification_settings ?? null, "test_overdue"));
    }
    return orgOn.get(orgId)!;
  }
  let sent = 0;
  const errors: string[] = [];

  for (const raw of rows ?? []) {
    const a = raw as unknown as {
      id: string; org_id: string; location_id: string | null; status: string;
      staff_members: { full_name: string } | null;
      tests: { title: string } | null;
    };
    if (!(await overdueOn(a.org_id))) continue;
    const staffName = a.staff_members?.full_name ?? "A team member";
    const testTitle = a.tests?.title ?? "a test";

    let dest = { to: FALLBACK_ALERT, name: "" };
    if (a.location_id) {
      if (!locEmail.has(a.location_id)) {
        const { data: loc } = await admin.from("locations").select("email, name").eq("id", a.location_id).maybeSingle();
        locEmail.set(a.location_id, { to: (loc?.email || "").trim() || FALLBACK_ALERT, name: loc?.name || "" });
      }
      dest = locEmail.get(a.location_id)!;
    }

    try {
      await sendEmail({
        to: [dest.to],
        subject: `Overdue test: ${staffName} hasn't finished ${testTitle}`,
        html: `<p><strong>${staffName}</strong>${dest.name ? ` (${dest.name})` : ""} hasn't completed the <strong>${testTitle}</strong> test by its deadline.</p>
<p>${a.status === "in_progress" ? "They started it but didn't finish." : "They haven't started it yet."} A quick check-in and some coaching will help them get it done.</p>
<p>See where everyone stands on the test's page in Wingman (Training → Tests).</p>`,
      });
      await admin.from("test_assignments").update({ due_alerted: true }).eq("id", a.id);
      sent++;
    } catch (e) {
      errors.push(`${a.id}: ${e instanceof Error ? e.message : "send failed"}`);
    }
  }

  return NextResponse.json({ ok: true, considered: rows?.length ?? 0, sent, errors });
}
