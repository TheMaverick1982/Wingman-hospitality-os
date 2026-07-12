import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_ACCESS_OPTIONS } from "@/lib/auth/platform";
import { TeamManager, type StaffRow } from "./team-manager";

export const maxDuration = 60;

export default async function AdminTeamPage() {
  const me = await requirePlatformSection("team");

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, platform_access, w9_status, w9_file_path")
    .eq("is_platform_admin", true)
    .order("full_name");

  const staff: StaffRow[] = [];
  for (const p of (profiles ?? []) as { id: string; full_name: string; platform_access: string[] | null; w9_status: string | null; w9_file_path: string | null }[]) {
    let email = "";
    let pending = false;
    try {
      const { data } = await admin.auth.admin.getUserById(p.id);
      const u = data?.user as { email?: string; email_confirmed_at?: string; confirmed_at?: string; last_sign_in_at?: string } | undefined;
      email = u?.email ?? "";
      // "Pending" = invited but hasn't confirmed / signed in yet.
      pending = !(u?.email_confirmed_at || u?.confirmed_at || u?.last_sign_in_at);
    } catch {
      /* skip */
    }
    staff.push({
      id: p.id,
      fullName: p.full_name,
      email,
      access: p.platform_access ?? [],
      pending,
      w9Status: (p.w9_status as StaffRow["w9Status"]) ?? "none",
      hasW9: !!p.w9_file_path,
    });
  }

  return (
    <>
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Team</h1>
        <p className="text-base text-muted">Add teammates to the platform admin area and choose what each can access.</p>
      </div>

      <TeamManager
        staff={staff}
        sections={PLATFORM_ACCESS_OPTIONS.map((s) => ({ key: s.key, label: s.label, description: s.description }))}
        currentUserId={me.userId}
      />
    </>
  );
}
