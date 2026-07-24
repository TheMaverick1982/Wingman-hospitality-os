import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection } from "@/lib/auth/permissions";
import { getRecipeSteps } from "@/lib/data/recipes";
import { resolveMyStaff } from "@/lib/data/my-staff";
import { RecipeEditor } from "./recipe-editor";
import { RecipeTestButton } from "./recipe-test-button";

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

  // Managers/owners edit; Chef staff view (demo-aware, so a demo Chef view can
  // open it too). Anyone else is sent back to Training.
  let canView = canEdit;
  if (!canView && profile.accessRole === "staff") {
    const my = await resolveMyStaff(profile);
    canView = !!my && RECIPE_VIEW_ROLES.includes(my.department);
  }
  if (!canView) redirect("/training");

  const steps = await getRecipeSteps(itemId);

  // Managers/owners get a one-click "turn this recipe into a test". Show whether
  // one already exists so the button reads "Update" vs "Turn into a test".
  // Guarded: the source_menu_item_id column lands with a migration, so a
  // not-yet-migrated environment just treats it as "no test yet".
  let hasRecipeTest = false;
  if (canEdit) {
    try {
      const { data: existingTest } = await supabase.from("tests").select("id").eq("source_menu_item_id", itemId).maybeSingle();
      hasRecipeTest = !!existingTest;
    } catch {
      hasRecipeTest = false;
    }
  }

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
        {canEdit && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-[13px] text-muted-2">
              Ready to check they know it? Turn this recipe into a quick learn-then-quiz test.
            </p>
            <RecipeTestButton menuItemId={dish.id} hasTest={hasRecipeTest} hasSteps={steps.length > 0} />
          </div>
        )}
      </div>
      <RecipeEditor menuItemId={dish.id} steps={steps} canEdit={canEdit} />
    </>
  );
}
