import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { canEditSection, getSectionAccess } from "@/lib/auth/permissions";
import type { MenuItemRow } from "@/lib/menu-engineering";
import { MenuClient } from "./menu-client";

export default async function MenuPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (getSectionAccess(profile.accessRole, "menu", profile.permissionOverrides) === "none") redirect("/dashboard");

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("menu_engineering_items")
    .select("id, name, price, food_cost, popularity")
    .order("sort_order");

  return (
    <MenuClient
      items={(items ?? []) as MenuItemRow[]}
      canEdit={canEditSection(profile.accessRole, "menu", profile.permissionOverrides)}
    />
  );
}
