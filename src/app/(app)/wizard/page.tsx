import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { WizardForm } from "./wizard-form";

// The wizard generates a whole system with the model; give it room to finish
// instead of hitting the platform's short default function timeout.
export const maxDuration = 60;

export default async function WizardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.accessRole !== "super_admin") redirect("/dashboard");

  return (
    <div className="max-w-[880px] mx-auto w-full">
      <WizardForm orgName={profile.orgName} />
    </div>
  );
}
