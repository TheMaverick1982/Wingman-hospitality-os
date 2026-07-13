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

// Confirm an interview: set the date/time + details and move the application
// into the candidates area (status 'interviewing').
export async function confirmInterview(id: string, when: string, details: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  if (!when) return { error: "Pick an interview date and time." };
  const iso = new Date(when).toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_applications")
    .update({ interview_at: iso, interview_details: (details || "").slice(0, 2000), status: "interviewing", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// Move a scheduled interview back to the applications list.
export async function unconfirmInterview(id: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_applications")
    .update({ status: "contacted", updated_at: new Date().toISOString() })
    .eq("id", id);
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

// Save the catch-all copy list (comma-separated emails) that every application
// notification is also sent to, on top of the location's email.
export async function updateApplicationsCc(value: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  const cleaned = value
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"))
    .join(", ");
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };
  const { error } = await supabase.from("organizations").update({ applications_cc: cleaned }).eq("id", (org as { id: string }).id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}

// Upload (or replace) the org logo shown on the public application form.
export async function uploadOrgLogo(formData: FormData): Promise<{ error: string | null; url?: string }> {
  const profile = await gate();
  if (!profile) return { error: "Not authorized." };
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { error: "Choose an image first." };
  if (!file.type.startsWith("image/")) return { error: "Upload an image (PNG, JPG, or SVG)." };
  if (file.size > 3 * 1024 * 1024) return { error: "Logo is too large — 3MB max." };

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${profile.orgId}/logo-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const up = await admin.storage.from("org-logos").upload(path, bytes, { contentType: file.type, upsert: true });
  if (up.error) return { error: "Couldn't upload that image. Try again." };
  const { data: pub } = admin.storage.from("org-logos").getPublicUrl(path);
  const url = pub.publicUrl;
  await admin.from("organizations").update({ logo_url: url }).eq("id", profile.orgId);
  revalidatePath("/hiring");
  return { error: null, url };
}

export async function removeOrgLogo(): Promise<{ error: string | null }> {
  const profile = await gate();
  if (!profile) return { error: "Not authorized." };
  const admin = createAdminClient();
  await admin.from("organizations").update({ logo_url: null }).eq("id", profile.orgId);
  revalidatePath("/hiring");
  return { error: null };
}

export async function deleteApplication(id: string): Promise<{ error: string | null }> {
  if (!(await gate())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.from("job_applications").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hiring");
  return { error: null };
}
