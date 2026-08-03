import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { QuestionsClient, type QuestionRow } from "./questions-client";

export const metadata = { title: "Questions · Wingman" };

// Staff → manager questions escalated from the Ask Wingman assistant. Managers
// and owners get the inbox (answer + optionally save to the playbook); staff see
// their own questions and the answers. Read via the admin client scoped to the
// org — access is enforced here and re-checked in the answer action.
export default async function QuestionsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const access = getSectionAccess(profile.accessRole, "questions", profile.permissionOverrides);
  if (access === "none") redirect("/dashboard");
  const canAnswer = access === "full";

  const admin = createAdminClient();
  let query = admin
    .from("staff_questions")
    .select("id, question, answer, status, asked_by_name, answered_by_name, answered_at, saved_to_playbook, created_at")
    .eq("org_id", profile.orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!canAnswer) query = query.eq("asked_by", profile.userId);
  const { data } = await query;
  const rows = (data ?? []) as QuestionRow[];

  return <QuestionsClient rows={rows} canAnswer={canAnswer} />;
}
