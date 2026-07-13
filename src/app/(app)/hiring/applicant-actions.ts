"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canEditSection } from "@/lib/auth/permissions";

const STATUSES = ["new", "contacted", "not_a_fit", "hired"] as const;
export type ApplicationStatus = (typeof STATUSES)[number];

async function gate() {
  const p = await getCurrentProfile();
  return p && canEditSection(p.accessRole, "hiring", p.permissionOverrides) ? p : null;
}

export async function updateApplicationStatus(id: string, status: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  if (!STATUSES.includes(status as ApplicationStatus)) return { error: "Invalid status." };
  const supabase = await createClient();
  const { error } = await supabase.from("job_applications").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

export async function scheduleApplicationVisit(id: string, when: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  const iso = when ? new Date(when).toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_applications")
    .update({ preferred_visit_at: iso, visit_confirmed: Boolean(iso), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// A short-lived signed URL to view a private resume (managers with Hiring
// access only). The row read is under RLS; the file is fetched via admin.
export async function getResumeUrl(id: string): Promise<{ url: string | null; error: string | null }> {
  if (!(await gate())) return { url: null, error: "Not authorized." };
  const supabase = await createClient();
  const { data } = await supabase.from("job_applications").select("resume_path").eq("id", id).maybeSingle();
  const path = (data as { resume_path: string | null } | null)?.resume_path;
  if (!path) return { url: null, error: "No resume on file." };
  const admin = createAdminClient();
  const { data: signed } = await admin.storage.from("resumes").createSignedUrl(path, 300);
  return { url: signed?.signedUrl ?? null, error: signed?.signedUrl ? null : "Couldn't open that resume." };
}

export async function deleteApplication(id: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.from("job_applications").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}
