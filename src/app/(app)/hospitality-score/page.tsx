import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSectionAccess } from "@/lib/auth/permissions";
import { ScoreClient, type AssessmentRow } from "./score-client";

export const metadata = { title: "Hospitality Score · Wingman" };

// The Hospitality Score self-assessment + history. Owner-facing diagnostic, shown
// to the Reporting audience (owner full, manager view). Only the owner submits.
export default async function HospitalityScorePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const access = getSectionAccess(profile.accessRole, "reporting", profile.permissionOverrides);
  if (access === "none") redirect("/dashboard");
  const canTake = profile.accessRole === "super_admin";

  const admin = createAdminClient();
  const { data } = await admin
    .from("hospitality_assessments")
    .select("id, scores, total, created_at")
    .eq("org_id", profile.orgId)
    .order("created_at", { ascending: false })
    .limit(12);
  const history: AssessmentRow[] = ((data ?? []) as { id: string; scores: number[] | null; total: number; created_at: string }[])
    .map((r) => ({ id: r.id, scores: Array.isArray(r.scores) ? r.scores : [], total: r.total, createdAt: r.created_at }));

  return <ScoreClient canTake={canTake} history={history} />;
}
