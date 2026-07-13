import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getOrgLocations } from "@/lib/data/locations";
import { getSectionAccess } from "@/lib/auth/permissions";
import { StaffProfileClient } from "./staff-profile-client";
import { InviteLoginBanner } from "./invite-login-banner";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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

  // Activity overview: tests assigned to this person + their personal checklist
  // completions (pre-shift + loyalty), so everything they touch lives here.
  const thirtyDaysAgo = daysAgoIso(30);
  const [{ data: testAssignments }, { data: completions }] = await Promise.all([
    supabase
      .from("test_assignments")
      .select("test_id, status, best_score, last_score, current_day, due_at, tests(title, day_count, pass_pct)")
      .eq("staff_id", id),
    staff.profile_id
      ? supabase
          .from("shift_checklist_completions")
          .select("checklist_type, occurred_on")
          .eq("profile_id", staff.profile_id)
          .in("checklist_type", ["preshift", "loyalty"])
          .gte("occurred_on", thirtyDaysAgo)
          .order("occurred_on", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const tests = ((testAssignments ?? []) as unknown as {
    test_id: string; status: string; best_score: number | null; last_score: number | null; current_day: number; due_at: string | null;
    tests: { title: string; day_count: number; pass_pct: number } | null;
  }[]).map((a) => ({
    testId: a.test_id,
    title: a.tests?.title ?? "Test",
    status: a.status,
    score: a.best_score ?? a.last_score,
    passPct: a.tests?.pass_pct ?? 80,
    day: a.current_day,
    dayCount: a.tests?.day_count ?? 1,
    due: a.due_at,
  }));

  const compRows = (completions ?? []) as { checklist_type: string; occurred_on: string }[];
  const summarize = (type: string) => {
    const rows = compRows.filter((c) => c.checklist_type === type);
    return { count: rows.length, last: rows[0]?.occurred_on ?? null };
  };
  const checklists = { hasLogin: Boolean(staff.profile_id), preshift: summarize("preshift"), loyalty: summarize("loyalty") };

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
      tests={tests}
      checklists={checklists}
      initialTab={tab === "training" || tab === "tests" || tab === "hiring" || tab === "contact" ? tab : "activity"}
    />
    </>
  );
}
