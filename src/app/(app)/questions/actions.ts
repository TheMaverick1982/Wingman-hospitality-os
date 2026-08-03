"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { alertManagersOfQuestion, notifyAskerOfAnswer } from "@/lib/staff-questions";

export type QuestionActionState = { error: string | null; ok?: boolean };

// A staff member escalates a question the assistant couldn't answer to their
// managers. Anyone signed in can ask. Managers are alerted (push + email).
export async function askManager(question: string): Promise<QuestionActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const q = (question ?? "").trim();
  if (q.length < 3) return { error: "Type your question first." };
  if (q.length > 2000) return { error: "That question is too long." };

  const admin = createAdminClient();
  const { error } = await admin.from("staff_questions").insert({
    org_id: profile.orgId,
    location_id: profile.locationId,
    asked_by: profile.userId,
    asked_by_name: profile.fullName || "A team member",
    asked_by_email: profile.email ?? null,
    question: q,
    status: "open",
  });
  if (error) return { error: "Couldn't send that just now — please try again." };

  await alertManagersOfQuestion(admin, {
    orgId: profile.orgId,
    locationId: profile.locationId,
    askerName: profile.fullName || "A team member",
    question: q,
  }).catch(() => undefined);

  revalidatePath("/questions");
  return { error: null, ok: true };
}

// A manager answers an open question. Optionally saves the Q&A to the Team
// Playbook so the assistant handles it automatically next time. Notifies the
// asker (push + email).
export async function answerQuestion(input: {
  id: string;
  answer: string;
  saveToPlaybook: boolean;
}): Promise<QuestionActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (getSectionAccess(profile.accessRole, "questions", profile.permissionOverrides) !== "full") {
    return { error: "Only managers can answer questions." };
  }

  const answer = (input.answer ?? "").trim();
  if (answer.length < 2) return { error: "Write an answer first." };
  if (answer.length > 4000) return { error: "That answer is too long." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("staff_questions")
    .select("id, org_id, question, asked_by, asked_by_email")
    .eq("id", input.id)
    .maybeSingle();
  const q = row as { id: string; org_id: string; question: string; asked_by: string | null; asked_by_email: string | null } | null;
  if (!q || q.org_id !== profile.orgId) return { error: "That question no longer exists." };

  const { error } = await admin
    .from("staff_questions")
    .update({
      answer,
      answered_by: profile.userId,
      answered_by_name: profile.fullName || "A manager",
      answered_at: new Date().toISOString(),
      status: "answered",
      saved_to_playbook: Boolean(input.saveToPlaybook),
      updated_at: new Date().toISOString(),
    })
    .eq("id", q.id)
    .eq("org_id", profile.orgId);
  if (error) return { error: "Couldn't save that answer — please try again." };

  // Save the answer into the Team Playbook so the assistant learns it. The
  // article's title is the question and the body is the answer — exactly the
  // shape buildRestaurantKnowledge() reads.
  if (input.saveToPlaybook) {
    await admin
      .from("playbook_articles")
      .insert({
        org_id: profile.orgId,
        title: q.question.slice(0, 200),
        body: answer,
        created_by: profile.userId,
      })
      .then(undefined, () => undefined);
  }

  await notifyAskerOfAnswer({
    askerUserId: q.asked_by,
    askerEmail: q.asked_by_email,
    question: q.question,
    answer,
  }).catch(() => undefined);

  revalidatePath("/questions");
  return { error: null, ok: true };
}
