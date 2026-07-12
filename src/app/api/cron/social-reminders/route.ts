import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { BILLING_OWNER_EMAIL } from "@/lib/billing";
import { publicImageUrl, IMAGE_RETENTION_DAYS, type SocialPost } from "@/lib/social";
import { deleteSocialImages } from "@/lib/social-storage";

// Assisted-post reminders + image cleanup. Runs hourly.
//   1. Any scheduled post whose time has arrived → email the owner a reminder
//      (caption + image links + a link to the planner) once.
//   2. Posted images older than IMAGE_RETENTION_DAYS → delete from storage to
//      save space (the post is already live on the platform by then).
export const maxDuration = 60;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.joinwingman.app";

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  let reminded = 0;
  let purged = 0;

  // 1. Due reminders.
  const { data: due } = await admin
    .from("social_posts")
    .select("*")
    .eq("status", "scheduled")
    .is("reminder_sent_at", null)
    .lte("scheduled_at", nowIso)
    .limit(50);

  for (const p of (due ?? []) as SocialPost[]) {
    const imgs = p.image_paths.map(publicImageUrl);
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:560px;">
      <p style="font-size:16px;font-weight:600;">Time to post 🛬</p>
      <p style="font-size:14px;color:#525252;">Scheduled for ${esc(new Date(p.scheduled_at ?? nowIso).toLocaleString())} · ${esc(p.platforms.join(", "))}</p>
      <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin:12px 0;">
        <p style="font-size:15px;white-space:pre-wrap;">${esc(p.caption)}</p>
        ${p.link ? `<p style="font-size:14px;"><a href="${esc(p.link)}" style="color:#c0392b;">${esc(p.link)}</a></p>` : ""}
        ${p.first_comment ? `<p style="font-size:13px;color:#777;">1st comment: ${esc(p.first_comment)}</p>` : ""}
        ${imgs.map((u) => `<p style="font-size:13px;"><a href="${esc(u)}" style="color:#c0392b;">Download image</a></p>`).join("")}
      </div>
      <p style="font-size:14px;"><a href="${SITE}/admin/social" style="color:#0a6cff;font-weight:600;">Open the planner</a> to copy the caption and mark it posted.</p>
    </div>`;
    try {
      await sendEmail({ to: [BILLING_OWNER_EMAIL], subject: `Post reminder: ${p.caption.slice(0, 60) || "your scheduled post"}`, html });
      await admin.from("social_posts").update({ reminder_sent_at: nowIso }).eq("id", p.id);
      reminded++;
    } catch (e) {
      console.error("[social] reminder failed", p.id, e);
    }
  }

  // 2. Purge old posted images.
  const cutoff = new Date(Date.now() - IMAGE_RETENTION_DAYS * 86400000).toISOString();
  const { data: stale } = await admin
    .from("social_posts")
    .select("id, image_paths")
    .eq("status", "posted")
    .is("images_purged_at", null)
    .lt("posted_at", cutoff)
    .limit(100);

  for (const p of (stale ?? []) as { id: string; image_paths: string[] }[]) {
    if (p.image_paths.length === 0) {
      await admin.from("social_posts").update({ images_purged_at: nowIso }).eq("id", p.id);
      continue;
    }
    await deleteSocialImages(p.image_paths);
    await admin.from("social_posts").update({ image_paths: [], images_purged_at: nowIso }).eq("id", p.id);
    purged++;
  }

  return NextResponse.json({ ok: true, reminded, purged });
}
