"use server";

import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import {
  generateDraft, createPost, updatePost, setPostStatus, deletePost, listAllPosts,
  type Draft, type PostStatus,
} from "@/lib/playbook";

async function admin() {
  return platformSectionActor("social");
}

export async function generateDraftAction(category: string, topic: string): Promise<{ error: string | null; draft?: Draft }> {
  if (!(await admin())) return { error: "Not authorized." };
  const existing = (await listAllPosts()).map((p) => p.title);
  const draft = await generateDraft({ category, topic: topic.trim() || undefined, existingTitles: existing });
  if (!draft) return { error: "Couldn't generate a draft (the AI may be unavailable). Try again." };
  return { error: null, draft };
}

export type SaveInput = { id: string | null; title: string; excerpt: string; body: string; category: string; keywords: string[]; status: PostStatus; scheduledFor: string | null };

export async function savePostAction(input: SaveInput): Promise<{ error: string | null; id?: string }> {
  const me = await admin();
  if (!me) return { error: "Not authorized." };
  if (!input.title.trim() || !input.body.trim()) return { error: "A title and body are required." };
  let id = input.id;
  if (id) {
    await updatePost(id, { title: input.title, excerpt: input.excerpt, body: input.body, category: input.category, keywords: input.keywords });
    await setPostStatus(id, input.status, input.scheduledFor);
  } else {
    id = await createPost(me.userId, { title: input.title, excerpt: input.excerpt, body: input.body, category: input.category, keywords: input.keywords, status: input.status, scheduledFor: input.scheduledFor });
    if (!id) return { error: "Couldn't save the post." };
  }
  revalidatePath("/admin/playbook");
  revalidatePath("/playbook");
  return { error: null, id };
}

export async function setStatusAction(id: string, status: PostStatus): Promise<{ error: string | null }> {
  if (!(await admin())) return { error: "Not authorized." };
  await setPostStatus(id, status);
  revalidatePath("/admin/playbook");
  revalidatePath("/playbook");
  return { error: null };
}

export async function deletePostAction(id: string): Promise<{ error: string | null }> {
  if (!(await admin())) return { error: "Not authorized." };
  await deletePost(id);
  revalidatePath("/admin/playbook");
  revalidatePath("/playbook");
  return { error: null };
}
