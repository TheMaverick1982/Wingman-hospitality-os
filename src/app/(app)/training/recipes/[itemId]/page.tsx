import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection } from "@/lib/auth/permissions";
import { getRecipeSteps } from "@/lib/data/recipes";
import { RecipeEditor } from "./recipe-editor";

// Roles that can VIEW a recipe (managers/owners also edit). Keep in sync with the
// list in the Training page.
const RECIPE_VIEW_ROLES = ["Chef"];

// Server actions here upload/resize photos; give them room past the short default.
export const maxDuration = 60;

export default async function RecipePage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const canEdit = canEditSection(profile.accessRole, "training", profile.permissionOverrides);
  const supabase = await createClient();

  // RLS scopes this to the caller's org, so an id from another org resolves to nothing.
  const { data: item } = await supabase.from("menu_items").select("id, name, department").eq("id", itemId).maybeSingle();
  if (!item) notFound();
  const dish = item as { id: string; name: string; department: string };

  // Managers/owners edit; Chef staff view. Anyone else is sent back to Training.
  let canView = canEdit;
  if (!canView && profile.accessRole === "staff") {
    const { data: myStaff } = await supabase
      .from("staff_members")
      .select("department")
      .eq("profile_id", profile.userId)
      .is("deleted_at", null)
      .maybeSingle();
    const dept = (myStaff as { department?: string } | null)?.department ?? null;
    canView = !!dept && RECIPE_VIEW_ROLES.includes(dept);
  }
  if (!canView) redirect("/training");

  const steps = await getRecipeSteps(itemId);

  return (
    <>
      <div>
        <Link href="/training" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-2 hover:text-ink mb-2">
          <ArrowLeft size={14} /> Training
        </Link>
        <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] text-ink">{dish.name}</h1>
        <p className="text-base text-muted mt-1">
          Recipe — step by step, with photos, so any cook can make it to spec.
        </p>
      </div>
      <RecipeEditor menuItemId={dish.id} steps={steps} canEdit={canEdit} />
    </>
  );
}
