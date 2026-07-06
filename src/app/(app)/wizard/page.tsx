import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { WizardForm } from "./wizard-form";

export default async function WizardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.accessRole !== "gm") redirect("/dashboard");

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Set up your hospitality system</h1>
      <p className="text-sm text-muted mb-8">
        Answer a few questions. We&apos;ll draft your culture statement and department training — guest
        experience built into every role.
      </p>
      <WizardForm orgName={profile.orgName} />
    </div>
  );
}
