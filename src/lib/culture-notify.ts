import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { isNotificationEnabled, type NotificationSettings, type NotificationKey } from "@/lib/notifications";

// Push culture moments to the whole team's phones (everyone who installed the
// app / enabled notifications). Best-effort and self-contained: builds its own
// admin client, never throws into the caller, and no-ops when the org has turned
// the matching toggle off. sendPushToUser is a no-op for anyone without a push
// subscription, so this naturally only reaches people who have the app.

async function settingOn(admin: ReturnType<typeof createAdminClient>, orgId: string, key: NotificationKey): Promise<boolean> {
  try {
    const { data } = await admin.from("organizations").select("notification_settings").eq("id", orgId).maybeSingle();
    const settings = (data as { notification_settings?: NotificationSettings } | null)?.notification_settings ?? null;
    return isNotificationEnabled(settings, key);
  } catch {
    return true; // default on if we can't read the setting
  }
}

async function teamIds(admin: ReturnType<typeof createAdminClient>, orgId: string, excludeId?: string): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("org_id", orgId);
  return ((data ?? []) as { id: string }[]).map((r) => r.id).filter((id) => id && id !== excludeId);
}

// A win or shout-out was posted — buzz the rest of the team. `about` is the
// recognized teammate (shout-outs); `kind` is "win" | "shoutout".
export async function pushCultureMomentToTeam(p: {
  orgId: string;
  authorId?: string | null;
  authorName: string;
  kind: string;
  about?: string | null;
  message: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!(await settingOn(admin, p.orgId, "culture_wins"))) return;
    const ids = await teamIds(admin, p.orgId, p.authorId ?? undefined);
    if (ids.length === 0) return;
    const isWin = p.kind === "win";
    const who = (p.about ?? "").trim();
    const title = isWin ? `🎉 ${p.authorName} shared a win` : `🎉 ${p.authorName} recognized ${who || "a teammate"}`;
    const payload = { title, body: p.message.slice(0, 140), url: "/culture", tag: "culture-win" };
    await Promise.all(ids.map((id) => sendPushToUser(id, payload).catch(() => 0)));
  } catch {
    /* best-effort */
  }
}

// The weekly pre-shift focus or the weekly experiment was set — point the whole
// team at it. `kind` is "focus" | "experiment".
export async function pushWeeklyCultureToTeam(p: {
  orgId: string;
  kind: "focus" | "experiment";
  text: string;
  bySetterId?: string | null;
}): Promise<void> {
  try {
    const text = p.text.trim();
    if (!text) return;
    const admin = createAdminClient();
    if (!(await settingOn(admin, p.orgId, "culture_focus"))) return;
    const ids = await teamIds(admin, p.orgId, p.bySetterId ?? undefined);
    if (ids.length === 0) return;
    const title = p.kind === "focus" ? "📣 This week's focus" : "🧪 This week's experiment";
    const payload = { title, body: text.slice(0, 160), url: "/culture", tag: `culture-${p.kind}` };
    await Promise.all(ids.map((id) => sendPushToUser(id, payload).catch(() => 0)));
  } catch {
    /* best-effort */
  }
}
