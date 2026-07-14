import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type OrgSetup = { steps: { label: string; done: boolean }[]; doneCount: number; total: number };

// Setup/onboarding progress for a specific org, read with the service-role
// client (no RLS). Mirrors lib/onboarding.ts: 'wingman'-sourced rows are the
// signal a section was actually built out, not left at seeded defaults.
export async function getOrgSetup(admin: Admin, orgId: string): Promise<OrgSetup> {
  const [{ data: org }, { count: standards }, { count: training }, { count: traits }, { count: staff }, { count: playbook }] = await Promise.all([
    admin.from("organizations").select("system_generated").eq("id", orgId).maybeSingle(),
    admin.from("department_standards").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "wingman"),
    admin.from("department_training_items").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "wingman"),
    admin.from("hiring_traits").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "wingman"),
    admin.from("staff_members").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    admin.from("playbook_articles").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);

  const steps = [
    { label: "Setup Wizard", done: !!(org as { system_generated?: boolean } | null)?.system_generated },
    { label: "Training & Standards", done: (standards ?? 0) + (training ?? 0) > 0 },
    { label: "Hiring criteria", done: (traits ?? 0) > 0 },
    { label: "Team added", done: (staff ?? 0) > 0 },
    { label: "Team playbook", done: (playbook ?? 0) > 0 },
  ];
  return { steps, doneCount: steps.filter((s) => s.done).length, total: steps.length };
}

export type OrgLogins = { lastLogin: string | null; activated: number; total: number };

// Login activity across an org's team, from Supabase auth. getUserById is the
// official admin API for last_sign_in_at; team sizes are small, but cap the
// fan-out defensively.
export async function getOrgLogins(admin: Admin, memberIds: string[]): Promise<OrgLogins> {
  let lastLogin: string | null = null;
  let activated = 0;
  for (const id of memberIds.slice(0, 60)) {
    const { data } = await admin.auth.admin.getUserById(id);
    const ts = data?.user?.last_sign_in_at ?? null;
    if (ts) {
      activated++;
      if (!lastLogin || ts > lastLogin) lastLogin = ts;
    }
  }
  return { lastLogin, activated, total: memberIds.length };
}

// "3 days ago" / "2 hours ago" from an ISO timestamp.
export function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
