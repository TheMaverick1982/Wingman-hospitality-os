"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";

export type PlaybookArticle = {
  id: string;
  title: string;
  body: string;
  sort_order: number;
  updated_at: string;
};

export type PlaybookState = { error: string | null; id?: string };

export async function savePlaybookArticle(_prev: PlaybookState, formData: FormData): Promise<PlaybookState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return { error: "Only a Super Admin can edit the team playbook." };
  }

  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!title) return { error: "Give the guide a title." };
  if (title.length > 200) return { error: "Keep the title under 200 characters." };
  if (body.length > 20000) return { error: "This guide is too long — keep it under 20,000 characters." };

  const supabase = await createClient();

  if (id) {
    // RLS guarantees this only updates the caller's own org.
    const { error } = await supabase.from("playbook_articles").update({ title, body, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/help");
    revalidatePath(`/help/playbook/${id}`);
    return { error: null, id };
  }

  const { data: last } = await supabase
    .from("playbook_articles")
    .select("sort_order")
    .eq("org_id", profile.orgId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("playbook_articles")
    .insert({ org_id: profile.orgId, title, body, sort_order: sortOrder, created_by: profile.userId })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/help");
  return { error: null, id: inserted.id };
}

export async function deletePlaybookArticle(id: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return { error: "Only a Super Admin can delete a guide." };
  }
  if (!id) return { error: "Missing guide." };

  const supabase = await createClient();
  const { error } = await supabase.from("playbook_articles").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/help");
  return { error: null };
}
