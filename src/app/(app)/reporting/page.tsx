import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";

export default async function ReportingPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "reporting") === "none") redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Reporting</h1>
        <p className="text-sm text-muted max-w-xl">
          A cross-section rollup of every part of Wingman, with exports and scheduled email
          reports.
        </p>
      </div>
      <Card className="p-8 text-center">
        <p className="text-sm text-muted">Reporting is being built next — check back soon.</p>
      </Card>
    </div>
  );
}
