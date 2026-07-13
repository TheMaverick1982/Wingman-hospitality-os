import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { BILLING_OWNER_EMAIL } from "@/lib/billing";
import { publicImageUrl, IMAGE_RETENTION_DAYS, isAssistedOnly, type SocialPost } from "@/lib/social";
import { deleteSocialImages } from "@/lib/social-storage";
import { getSocialSettings } from "@/lib/social-meta";
import { publishAll, anyConnected } from "@/lib/social-publish";

// Social planner cron. Runs hourly:
//   1. Scheduled posts whose time has arrived: auto-PUBLISH via Meta if the
//      account is connected and auto-publish is on; otherwise email the owner an
//      assisted-post reminder (once).
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
  let published = 0;
  let purged = 0;

  const settings = await getSocialSettings();
  const autoPublish = Boolean(settings?.auto_publish) && anyConnected(settings);

  // 1. Due scheduled posts.
  const { data: due } = await admin
    .from("social_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .limit(50);

  for (const p of (due ?? []) as SocialPost[]) {
    // Auto-publish path: publish via Meta, mark posted, store live URLs. On a
    // failure, record the error and fall through to a reminder so it's not lost.
    // Stories are never auto-published (the API can't add a link sticker) — they
    // always fall through to the reminder to post by hand.
    if (autoPublish && settings && !isAssistedOnly(p.format)) {
      const outcome = await publishAll(p, settings);
      const anyLive = Boolean(outcome.facebook || outcome.instagram || outcome.linkedin);
      const publishedUrls = {
        ...(p.published_urls ?? {}),
        ...(outcome.facebook ? { facebook: outcome.facebook } : {}),
        ...(outcome.instagram ? { instagram: outcome.instagram } : {}),
        ...(outcome.linkedin ? { linkedin: outcome.linkedin } : {}),
      };
      if (anyLive && !outcome.error) {
        await admin
          .from("social_posts")
          .update({ status: "posted", posted_at: nowIso, published_urls: publishedUrls, publish_error: null, last_publish_at: nowIso, updated_at: nowIso })
          .eq("id", p.id);
        published++;
        continue;
      }
      // Partial/failed → record error and let the reminder below fire once.
      await admin
        .from("social_posts")
        .update({ published_urls: publishedUrls, publish_error: outcome.error ?? "Publish failed", last_publish_at: nowIso, updated_at: nowIso })
        .eq("id", p.id);
    }

    // Reminder path (also the fallback when auto-publish failed). Once only.
    if (p.reminder_sent_at) continue;
    const imgs = p.image_paths.map(publicImageUrl);
    const storyNote = p.format === "story"
      ? `<p style="font-size:13px;color:#b4884a;">Story — post it in the Instagram app so you can add the link sticker (the API can't).</p>`
      : "";
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:560px;">
      <p style="font-size:16px;font-weight:600;">Time to post 🛬</p>
      <p style="font-size:14px;color:#525252;">Scheduled for ${esc(new Date(p.scheduled_at ?? nowIso).toLocaleString())} · ${esc(p.platforms.join(", "))} · ${esc(p.format)}</p>
      ${storyNote}
      <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin:12px 0;">
        <p style="font-size:15px;white-space:pre-wrap;">${esc(p.caption)}</p>
        ${p.link ? `<p style="font-size:14px;"><a href="${esc(p.link)}" style="color:#0a6cff;">${esc(p.link)}</a></p>` : ""}
        ${p.first_comment ? `<p style="font-size:13px;color:#777;">1st comment: ${esc(p.first_comment)}</p>` : ""}
        ${imgs.map((u) => `<p style="font-size:13px;"><a href="${esc(u)}" style="color:#0a6cff;">Download image</a></p>`).join("")}
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

  // 1b. Content runway: warn the owner once when their furthest-out scheduled
  // post is inside the runway window (or they've run out), so they schedule more
  // before the queue goes dry. Cleared automatically once the runway is healthy
  // again, and re-armed at most weekly while it stays low.
  const RUNWAY_DAYS = 14;
  let runwayAlerted = false;
  try {
    const { count: totalPosts } = await admin.from("social_posts").select("id", { count: "exact", head: true });
    if (settings && (totalPosts ?? 0) > 0) {
      const [{ data: furthestRows }, { count: upcomingCount }] = await Promise.all([
        admin.from("social_posts").select("scheduled_at").eq("status", "scheduled").gte("scheduled_at", nowIso).order("scheduled_at", { ascending: false }).limit(1),
        admin.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("scheduled_at", nowIso),
      ]);
      const furthest = (furthestRows?.[0] as { scheduled_at: string } | undefined)?.scheduled_at ?? null;
      const daysLeft = furthest ? Math.ceil((new Date(furthest).getTime() - Date.now()) / 86400000) : -1;
      const low = !furthest || daysLeft <= RUNWAY_DAYS;
      const lastAlert = settings.content_runway_alert_at ? new Date(settings.content_runway_alert_at).getTime() : 0;

      if (low) {
        if (Date.now() - lastAlert >= 7 * 86400000) {
          const line = furthest
            ? `Your last scheduled post goes out ${esc(new Date(furthest).toLocaleDateString())} — about ${daysLeft} day${daysLeft === 1 ? "" : "s"} out. You have ${upcomingCount ?? 0} post${(upcomingCount ?? 0) === 1 ? "" : "s"} left in the queue.`
            : `You have no upcoming posts scheduled.`;
          const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;max-width:560px;">
            <p style="font-size:16px;font-weight:600;">Time to plan more posts 🗓️</p>
            <p style="font-size:14px;color:#525252;">${line} Keep the runway ahead of you so nothing goes quiet.</p>
            <p style="font-size:14px;"><a href="${SITE}/admin/social" style="color:#0a6cff;font-weight:600;">Open the planner</a> to schedule the next batch.</p>
          </div>`;
          try {
            await sendEmail({ to: [BILLING_OWNER_EMAIL], subject: "Your scheduled social posts are running low", html });
            await admin.from("social_settings").update({ content_runway_alert_at: nowIso }).eq("id", 1);
            runwayAlerted = true;
          } catch (e) {
            console.error("[social] runway alert failed", e);
          }
        }
      } else if (lastAlert) {
        // Runway healthy again — clear so it can fire fresh next time it dips.
        await admin.from("social_settings").update({ content_runway_alert_at: null }).eq("id", 1);
      }
    }
  } catch (e) {
    console.error("[social] runway check failed", e);
  }

  // 2. Purge old posted images (but never a post that failed to publish — its
  // image is kept so a Retry still works).
  const cutoff = new Date(Date.now() - IMAGE_RETENTION_DAYS * 86400000).toISOString();
  const { data: stale } = await admin
    .from("social_posts")
    .select("id, image_paths")
    .eq("status", "posted")
    .is("images_purged_at", null)
    .is("publish_error", null)
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

  return NextResponse.json({ ok: true, published, reminded, purged, runwayAlerted });
}
