import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Card } from "@/components/ui/card";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.accessRole !== "super_admin") redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 text-ink">Settings</h1>
        <p className="text-sm text-muted max-w-xl">
          Team & permissions, locations, and billing.
        </p>
      </div>
      <Card className="p-8 text-center">
        <p className="text-sm text-muted">Settings is being built next — check back soon.</p>
      </Card>
    </div>
  );
}
