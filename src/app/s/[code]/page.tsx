import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { FOH_DEPARTMENTS } from "@/lib/constants";
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

  const [{ data: orgRow }, { data: locRow }, { data: staffRows }] = await Promise.all([
    admin.from("organizations").select("name, logo_url").eq("id", link.org_id).maybeSingle(),
    admin.from("locations").select("name").eq("id", link.location_id).maybeSingle(),
    admin
      .from("staff_members")
      .select("id, full_name, department")
      .eq("org_id", link.org_id)
      .eq("location_id", link.location_id)
      .eq("status", "active"),
  ]);

  const orgName = (orgRow as { name?: string } | null)?.name ?? "our restaurant";
  const logoUrl = (orgRow as { logo_url?: string | null } | null)?.logo_url ?? null;
  const locationName = (locRow as { name?: string } | null)?.name ?? "";

  const servers: ServerOption[] = ((staffRows ?? []) as { id: string; full_name: string; department: string }[])
    .filter((s) => (FOH_DEPARTMENTS as readonly string[]).includes(s.department))
    .map((s) => ({ id: s.id, firstName: (s.full_name || "").trim().split(/\s+/)[0] || s.full_name }))
    .filter((s) => s.firstName)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));

  return (
    <SurveyForm code={code} orgName={orgName} locationName={locationName} logoUrl={logoUrl} servers={servers} />
  );
}
