import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { publishDuePosts, scheduledFuture, generateAndSchedule, RUNWAY_MIN, BATCH_SIZE } from "@/lib/playbook";

// The Playbook engine. Runs hourly:
//  1. Publishes any approved + scheduled post whose time (Tue/Thu noon ET) has
//     arrived, and posts it to the connected Facebook page.
//  2. Keeps the runway full: when fewer than RUNWAY_MIN approved-or-pending posts
//     remain scheduled, it drafts a fresh batch (scheduled, awaiting approval)
//     and emails the platform admins so they can review and approve.
export const maxDuration = 300;

async function platformAdminEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data: profs } = await admin.from("profiles").select("id").eq("is_platform_admin", true);
  const ids = ((profs ?? []) as { id: string }[]).map((p) => p.id);
  const emails: string[] = [];
  for (const id of ids.slice(0, 10)) {
    try {
      const { data } = await admin.auth.admin.getUserById(id);
      const e = data?.user?.email;
      if (e) emails.push(e);
    } catch {
      /* skip */
    }
  }
  return [...new Set(emails)];
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const published = await publishDuePosts();

  let generated = 0;
  const pending = await scheduledFuture();
  if (pending.length < RUNWAY_MIN) {
    const res = await generateAndSchedule(null, BATCH_SIZE);
    generated = res.created;
    if (generated > 0) {
      const emails = await platformAdminEmails();
      const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app").replace(/\/$/, "");
      if (emails.length) {
        await sendEmail({
          to: emails,
          subject: `The Playbook: ${generated} new post${generated === 1 ? "" : "s"} ready to review`,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:520px;"><h2 style="font-size:20px;">${generated} new Playbook draft${generated === 1 ? "" : "s"} scheduled</h2><p style="font-size:15px;line-height:1.55;color:#525252;">The Playbook was running low on scheduled posts, so ${generated} new one${generated === 1 ? " was" : "s were"} drafted and slotted into the Tuesday/Thursday noon ET calendar. They&apos;re waiting for your review. Approve the ones you like and they&apos;ll publish automatically at their scheduled time.</p><p style="font-size:15px;"><a href="${site}/admin/playbook" style="color:#0a6cff;font-weight:600;">Review and approve</a></p></div>`,
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ published: published.length, publishedSlugs: published, generated, scheduledRemaining: pending.length + generated });
}
