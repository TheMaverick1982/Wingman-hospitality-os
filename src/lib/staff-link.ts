import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// The single dedupe point for people. Whichever door someone comes through —
// hired from a candidate, added on the Staff page, or invited to log in — they
// end up as ONE staff_members row, matched by email within the org. Newly-known
// links (their login profile, their candidate record) are filled in when
// they arrive, so nothing has to be entered twice.

export type LinkStaffArgs = {
  email: string;
  fullName: string;
  department: string;
  locationId: string;
  phone?: string;
  profileId?: string | null;
  candidateId?: string | null;
  hiredOn?: string | null;
};

type ExistingStaff = { id: string; profile_id: string | null; candidate_id: string | null; phone: string };

export async function findStaffByEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient | any,
  orgId: string,
  email: string
): Promise<ExistingStaff | null> {
  const lower = email.trim().toLowerCase();
  if (!lower) return null;
  const { data } = await admin
    .from("staff_members")
    .select("id, profile_id, candidate_id, phone")
    .eq("org_id", orgId)
    .ilike("email", lower)
    .limit(1)
    .maybeSingle();
  return (data as ExistingStaff | null) ?? null;
}

// Returns the staff id (existing or newly created). Fills in profile_id /
// candidate_id / phone when they're newly known and were previously blank.
export async function linkOrCreateStaff(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient | any,
  orgId: string,
  args: LinkStaffArgs
): Promise<string | null> {
  const email = args.email.trim().toLowerCase();
  const existing = await findStaffByEmail(admin, orgId, email);

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (args.profileId && !existing.profile_id) patch.profile_id = args.profileId;
    if (args.candidateId && !existing.candidate_id) patch.candidate_id = args.candidateId;
    if (args.phone && !existing.phone) patch.phone = args.phone;
    if (args.hiredOn) patch.hired_on = args.hiredOn;
    if (Object.keys(patch).length > 0) {
      await admin.from("staff_members").update(patch).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await admin
    .from("staff_members")
    .insert({
      org_id: orgId,
      location_id: args.locationId,
      full_name: args.fullName,
      department: args.department,
      email,
      phone: args.phone ?? "",
      profile_id: args.profileId ?? null,
      candidate_id: args.candidateId ?? null,
      hired_on: args.hiredOn ?? null,
      status: "active",
    })
    .select("id")
    .single();
  if (error) return null;
  return (created as { id: string } | null)?.id ?? null;
}
