import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { WizardForm } from "./wizard-form";

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
