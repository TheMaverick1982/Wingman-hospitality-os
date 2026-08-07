"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { alertManagersOfChannelPost } from "@/lib/manager-channel-notify";

export type ChannelActionState = { error: string | null; ok?: boolean };

function canUse(role: Parameters<typeof getSectionAccess>[0], overrides: Parameters<typeof getSectionAccess>[2]) {
  return getSectionAccess(role, "manager_channel", overrides) !== "none";
}

// Post to the manager channel — a new thread (parentId null) or a reply. New
// threads alert the other managers; replies just appear in-app.
export async function postChannelMessage(input: { body: string; parentId?: string | null }): Promise<ChannelActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canUse(profile.accessRole, profile.permissionOverrides)) return { error: "The manager channel is for managers only." };

  const body = (input.body ?? "").trim().slice(0, 4000);
  const parentId = (input.parentId ?? null) || null;
  if (!body) return { error: "Write a message to post." };

  const supabase = await createClient();

  // If replying, make sure the parent is a real, live message in this org.
  if (parentId) {
    const { data: parent } = await supabase
      .from("manager_channel_messages")
      .select("id")
      .eq("id", parentId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!parent) return { error: "That thread is no longer available." };
  }

  const { error } = await supabase.from("manager_channel_messages").insert({
    org_id: profile.orgId,
    parent_id: parentId,
    author_id: profile.userId,
    author_name: profile.fullName || "A manager",
    body,
  });
  if (error) return { error: "Couldn't post that — please try again." };

  // Only new threads alert the other managers (push + email); replies don't.
  if (!parentId) {
    try {
      const admin = createAdminClient();
      await alertManagersOfChannelPost(admin, {
        orgId: profile.orgId,
        authorId: profile.userId,
        authorName: profile.fullName || "A manager",
        body,
      });
    } catch {
      /* best-effort */
    }
  }

  revalidatePath("/manager-channel");
  return { error: null, ok: true };
}

// Soft-delete a message (its author or any manager). Deleting a thread root also
// hides its replies via the feed query (they're only shown under a live root).
export async function deleteChannelMessage(id: string): Promise<ChannelActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (!canUse(profile.accessRole, profile.permissionOverrides)) return { error: "Not allowed." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("manager_channel_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", profile.orgId);
  if (error) return { error: "Couldn't remove that." };

  revalidatePath("/manager-channel");
  return { error: null, ok: true };
}
