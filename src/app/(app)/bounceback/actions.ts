"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

export async function saveGuest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guestId = String(formData.get("guestId") || "") || null;
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const referredAFriend = formData.get("referred_a_friend") === "on";

  if (!name) return { error: "Guest name is required." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found." };

  let id = guestId;
  if (id) {
    const { error } = await supabase
      .from("guests")
      .update({ name, phone, email, referred_a_friend: referredAFriend })
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("guests")
      .insert({ org_id: org.id, name, phone, email, referred_a_friend: referredAFriend })
      .select("id")
      .single();
    if (error) return { error: error.message };
    id = data.id;
  }

  const visits = [1, 2, 3, 4].map((n) => ({
    guest_id: id,
    org_id: org.id,
    visit_number: n,
    visit_date: String(formData.get(`visit_${n}_date`) || "") || null,
    location_id: String(formData.get(`visit_${n}_location`) || "") || null,
    incentive: String(formData.get(`visit_${n}_incentive`) || ""),
    notes: String(formData.get(`visit_${n}_notes`) || ""),
    reaction: String(formData.get(`visit_${n}_reaction`) || "") || null,
  }));

  const { error: visitsError } = await supabase
    .from("guest_visits")
    .upsert(visits, { onConflict: "guest_id,visit_number" });
  if (visitsError) return { error: visitsError.message };

  revalidatePath("/bounceback");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteGuest(guestId: string) {
  const supabase = await createClient();
  await supabase.from("guests").delete().eq("id", guestId);
  revalidatePath("/bounceback");
  revalidatePath("/dashboard");
}
