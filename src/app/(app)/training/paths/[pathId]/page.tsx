import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isManagerOrAbove } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveDepartments } from "@/lib/roles";
import { getPath, getPathOverview } from "@/lib/learning-paths";
import { PathEditor } from "./editor-client";

export const metadata = { title: "Edit path — Wingman" };

export default async function PathEditorPage({ params }: { params: Promise<{ pathId: string }> }) {
  const { pathId } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !isManagerOrAbove(profile.accessRole)) redirect("/training/paths");

  const path = await getPath(profile.orgId, pathId);
  if (!path) redirect("/training/paths");

  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: tests }, departments, { data: members }] = await Promise.all([
    supabase.from("tests").select("id, title").eq("active", true).order("title"),
    getActiveDepartments(),
    supabase.from("profiles").select("id, full_name, access_role").order("full_name"),
  ]);
  const staff = ((members ?? []) as { id: string; full_name: string; access_role: string }[]).map((m) => ({ id: m.id, name: m.full_name || "(unnamed)" }));
  const nameById = new Map(staff.map((s) => [s.id, s.name]));

  // Currently-assigned staff ids for this path.
  const { data: assignRows } = await admin.from("learning_path_assignments").select("staff_profile_id").eq("path_id", pathId);
  const assignedIds = ((assignRows ?? []) as { staff_profile_id: string }[]).map((r) => r.staff_profile_id);
  const overview = await getPathOverview(pathId, nameById);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <Link href="/training/paths" className="text-brick font-semibold text-sm">← Learning paths</Link>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink mt-2">{path.title}</h1>
        {path.description && <p className="text-sm text-muted mt-0.5">{path.description}</p>}
      </div>

      <PathEditor
        pathId={path.id}
        steps={path.steps.map((s) => ({ id: s.id, kind: s.kind, testId: s.testId, department: s.department, title: s.title, detail: s.detail }))}
        tests={(tests ?? []) as { id: string; title: string }[]}
        departments={departments as string[]}
        staff={staff}
        assignedIds={assignedIds}
        overview={overview}
      />
    </div>
  );
}
