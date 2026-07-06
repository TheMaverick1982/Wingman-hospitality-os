import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const { data: coreValues } = await supabase
    .from("core_values")
    .select("title")
    .order("sort_order");

  return (
    <div className="mx-auto max-w-2xl py-16">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-1">{profile.orgName}</h1>
          <p className="text-sm text-zinc-600">
            Logged in as {profile.fullName} —{" "}
            {profile.accessRole === "gm"
              ? "General Manager (all locations)"
              : `Store Manager, ${profile.locationName}`}
          </p>
        </div>
        <form action={logout}>
          <button className="text-sm font-semibold text-zinc-600 hover:text-zinc-900">
            Sign out
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-zinc-200 p-6">
        <h2 className="text-lg font-semibold mb-3">Core values</h2>
        {coreValues && coreValues.length > 0 ? (
          <ul className="list-disc list-inside text-sm text-zinc-700 flex flex-col gap-1">
            {coreValues.map((v) => (
              <li key={v.title}>{v.title}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No core values found.</p>
        )}
      </div>
    </div>
  );
}
