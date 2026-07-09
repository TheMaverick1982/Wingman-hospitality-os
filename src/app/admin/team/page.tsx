import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_SECTIONS } from "@/lib/auth/platform";
import { TeamManager, type StaffRow } from "./team-manager";

export const maxDuration = 60;

export default async function AdminTeamPage() {
  const me = await requirePlatformSection("team");

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, platform_access")
    .eq("is_platform_admin", true)
    .order("full_name");

  const staff: StaffRow[] = [];
  for (const p of (profiles ?? []) as { id: string; full_name: string; platform_access: string[] | null }[]) {
    let email = "";
    try {
      const { data } = await admin.auth.admin.getUserById(p.id);
      email = data?.user?.email ?? "";
    } catch {
      /* skip */
    }
    staff.push({ id: p.id, fullName: p.full_name, email, access: p.platform_access ?? [] });
  }

  return (
    <>
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Team</h1>
        <p className="text-base text-muted">Add teammates to the platform admin area and choose what each can access.</p>
      </div>

      <TeamManager
        staff={staff}
        sections={PLATFORM_SECTIONS.map((s) => ({ key: s.key, label: s.label, description: s.description }))}
        currentUserId={me.userId}
      />
    </>
  );
}
