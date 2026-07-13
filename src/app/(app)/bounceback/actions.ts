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

export type ImportRow = { name: string; email?: string; phone?: string; source?: string; firstVisitDate?: string };
export type ImportResult = { error: string | null; imported: number; skipped: number };

// Bulk-import guests from a mapped CSV. Each row becomes a guest; a valid
// firstVisitDate also creates their visit #1 (so they enter the bounce-back
// funnel dated correctly). Rows without a name are skipped.
export async function importGuests(rows: ImportRow[], locationId: string | null): Promise<ImportResult> {
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Nothing to import.", imported: 0, skipped: 0 };
  if (rows.length > 1000) return { error: "Import up to 1000 guests at a time.", imported: 0, skipped: 0 };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found.", imported: 0, skipped: 0 };

  // Only honor a location that actually belongs to this org.
  let loc: string | null = null;
  if (locationId) {
    const { data: l } = await supabase.from("locations").select("id").eq("id", locationId).eq("org_id", org.id).maybeSingle();
    loc = l ? locationId : null;
  }

  const dateOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const guestRows: { org_id: string; name: string; email: string; phone: string; source: string }[] = [];
  const firstVisit: (string | null)[] = [];
  let skipped = 0;
  for (const r of rows) {
    const name = (r.name || "").trim();
    if (!name) {
      skipped++;
      continue;
    }
    guestRows.push({
      org_id: org.id as string,
      name: name.slice(0, 200),
      email: (r.email || "").trim().slice(0, 200),
      phone: (r.phone || "").trim().slice(0, 60),
      source: ((r.source || "").trim() || "import").slice(0, 40),
    });
    const d = (r.firstVisitDate || "").trim();
    firstVisit.push(dateOk(d) ? d : null);
  }
  if (guestRows.length === 0) return { error: null, imported: 0, skipped };

  // A single multi-row INSERT ... RETURNING preserves input order, so we can zip
  // the returned ids back to each row's first-visit date.
  const { data: inserted, error } = await supabase.from("guests").insert(guestRows).select("id");
  if (error) return { error: error.message, imported: 0, skipped };
  const ids = ((inserted ?? []) as { id: string }[]).map((g) => g.id);

  const visits = ids
    .map((id, i) => (firstVisit[i] ? { guest_id: id, org_id: org.id, visit_number: 1, visit_date: firstVisit[i], location_id: loc } : null))
    .filter(Boolean);
  if (visits.length > 0) {
    await supabase.from("guest_visits").upsert(visits as object[], { onConflict: "guest_id,visit_number" });
  }

  revalidatePath("/bounceback");
  revalidatePath("/dashboard");
  return { error: null, imported: ids.length, skipped };
}

export async function deleteGuest(guestId: string) {
  const supabase = await createClient();
  await supabase.from("guests").delete().eq("id", guestId);
  revalidatePath("/bounceback");
  revalidatePath("/dashboard");
}
