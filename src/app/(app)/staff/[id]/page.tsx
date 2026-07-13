import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations } from "@/lib/data/locations";
import { getSectionAccess } from "@/lib/auth/permissions";
import { StaffProfileClient } from "./staff-profile-client";
import { InviteLoginBanner } from "./invite-login-banner";

export default async function StaffProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const access = getSectionAccess(profile.accessRole, "staff", profile.permissionOverrides);
  if (access === "none") return notFound();
  const canEdit = access === "full";

  const supabase = await createClient();
  const [{ data: staff }, locations] = await Promise.all([
    supabase
      .from("staff_members")
      .select("id, full_name, department, email, phone, status, location_id, candidate_id, hired_on, created_at, profile_id")
      .eq("id", id)
      .maybeSingle(),
    getOrgLocations(),
  ]);
  if (!staff) return notFound();
  const isSuperAdmin = profile.accessRole === "super_admin";

  const [
    { data: standards },
    { data: trainingItems },
    { data: meta },
    { data: progress },
    { data: signoffs },
    candidateResult,
  ] = await Promise.all([
    supabase
      .from("department_standards")
      .select("id, item, sort_order")
      .eq("department", staff.department)
      .order("sort_order"),
    supabase
      .from("department_training_items")
      .select("id, item, sort_order")
      .eq("department", staff.department)
      .order("sort_order"),
    supabase.from("department_meta").select("track_label").eq("department", staff.department).maybeSingle(),
    supabase
      .from("staff_training_progress")
      .select("item_type, item_id, checked, rating, note")
      .eq("staff_id", id),
    supabase
      .from("training_signoffs")
      .select("id, completion_pct, occurred_on")
      .eq("staff_id", id)
      .order("occurred_on", { ascending: false }),
    staff.candidate_id
      ? supabase
          .from("candidates")
          .select("id, name, department, occurred_on, scores, recommendation, notes")
          .eq("id", staff.candidate_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: coreValues } = staff.candidate_id
    ? await supabase.from("core_values").select("title").order("sort_order")
    : { data: null };

  return (
    <>
    {isSuperAdmin && !staff.profile_id && (
      <InviteLoginBanner staffId={staff.id} name={staff.full_name} email={staff.email} />
    )}
    <StaffProfileClient
      staff={staff}
      locationName={locations.find((l) => l.id === staff.location_id)?.name ?? ""}
      canEdit={canEdit}
      hospitalityItems={standards ?? []}
      roleItems={trainingItems ?? []}
      trackLabel={meta?.track_label ?? null}
      progress={progress ?? []}
      signoffs={signoffs ?? []}
      candidate={candidateResult?.data ?? null}
      coreValueTitles={(coreValues ?? []).map((v) => v.title)}
      initialTab={tab === "training" || tab === "hiring" ? tab : "contact"}
    />
    </>
  );
}
