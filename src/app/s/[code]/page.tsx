import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { GUEST_FACING_DEPARTMENTS } from "@/lib/constants";
import { SurveyForm } from "./survey-form";

// Public guest survey (no login), reached via the per-location QR / short link
// /s/<code>. Not indexed — it's a link the restaurant hands to guests.
export const metadata: Metadata = {
  title: "How was your visit?",
  robots: { index: false, follow: false },
};

type ServerOption = { id: string; firstName: string };

export default async function SurveyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = createAdminClient();

  const { data: linkRow } = await admin
    .from("guest_survey_links")
    .select("id, org_id, location_id, scan_count")
    .eq("code", code)
    .maybeSingle();
  const link = linkRow as { id: string; org_id: string; location_id: string; scan_count: number | null } | null;

  if (!link) {
    return (
      <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-5">
        <p className="text-[15px] text-muted text-center">This survey link is no longer active.</p>
      </main>
    );
  }

  // Count the scan (best-effort).
  await admin
    .from("guest_survey_links")
    .update({ scan_count: (link.scan_count ?? 0) + 1 })
    .eq("id", link.id)
    .then(undefined, () => undefined);

  const [{ data: orgRow }, { data: locRow }] = await Promise.all([
    admin.from("organizations").select("name, logo_url").eq("id", link.org_id).maybeSingle(),
    admin.from("locations").select("name").eq("id", link.location_id).maybeSingle(),
  ]);

  // All active staff in the org — we pick the best set to show below, so the
  // dropdown isn't empty just because a location has no FOH role assigned.
  // Guarded: exclude_from_survey lands with migration 0153, so fall back to the
  // base columns if it isn't there yet (the public survey must never crash).
  type StaffRow = { id: string; full_name: string; department: string; location_id: string | null; exclude_from_survey?: boolean };
  let staffRows: StaffRow[] = [];
  {
    const withCol = await admin
      .from("staff_members")
      .select("id, full_name, department, location_id, exclude_from_survey")
      .eq("org_id", link.org_id)
      .eq("status", "active");
    if (withCol.error) {
      const base = await admin
        .from("staff_members")
        .select("id, full_name, department, location_id")
        .eq("org_id", link.org_id)
        .eq("status", "active");
      staffRows = (base.data ?? []) as StaffRow[];
    } else {
      staffRows = (withCol.data ?? []) as StaffRow[];
    }
  }

  const orgName = (orgRow as { name?: string } | null)?.name ?? "our restaurant";
  const logoUrl = (orgRow as { logo_url?: string | null } | null)?.logo_url ?? null;
  const locationName = (locRow as { name?: string } | null)?.name ?? "";

  // Who to offer in "Who took care of you?", preferring the most relevant set
  // but never showing an empty dropdown when staff exist: FOH at this location →
  // FOH org-wide → anyone at this location → anyone active. Hidden staff
  // (marketing, catering, etc.) are dropped up front.
  const active = staffRows.filter((s) => !s.exclude_from_survey);
  const isGuestFacing = (d: string) => (GUEST_FACING_DEPARTMENTS as readonly string[]).includes(d);
  const gfAtLoc = active.filter((s) => isGuestFacing(s.department) && s.location_id === link.location_id);
  const gfOrg = active.filter((s) => isGuestFacing(s.department));
  const atLoc = active.filter((s) => s.location_id === link.location_id);
  const chosen = gfAtLoc.length ? gfAtLoc : gfOrg.length ? gfOrg : atLoc.length ? atLoc : active;

  const servers: ServerOption[] = chosen
    .map((s) => ({ id: s.id, firstName: (s.full_name || "").trim().split(/\s+/)[0] || s.full_name }))
    .filter((s) => s.firstName)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));

  return (
    <SurveyForm code={code} orgName={orgName} locationName={locationName} logoUrl={logoUrl} servers={servers} />
  );
}
