"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { logAudit } from "@/lib/audit-log";
import { logActivity } from "@/lib/activity-log";

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

  const parseBill = (raw: string): number | null => {
    const v = raw.trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const visits = [1, 2, 3, 4].map((n) => ({
    guest_id: id,
    org_id: org.id,
    visit_number: n,
    visit_date: String(formData.get(`visit_${n}_date`) || "") || null,
    location_id: String(formData.get(`visit_${n}_location`) || "") || null,
    incentive: String(formData.get(`visit_${n}_incentive`) || ""),
    notes: String(formData.get(`visit_${n}_notes`) || ""),
    reaction: String(formData.get(`visit_${n}_reaction`) || "") || null,
    bill_total: parseBill(String(formData.get(`visit_${n}_bill_total`) || "")),
  }));

  const { error: visitsError } = await supabase
    .from("guest_visits")
    .upsert(visits, { onConflict: "guest_id,visit_number" });
  if (visitsError) return { error: visitsError.message };

  const actor = await getCurrentProfile();
  if (actor) await logActivity({ orgId: actor.orgId, actorId: actor.userId, actorName: actor.fullName, area: "guests", action: guestId ? "updated" : "created", label: name });

  revalidatePath("/bounceback");
  revalidatePath("/dashboard");
  return { error: null };
}

export type ImportVisit = { n: number; date: string; incentive?: string; notes?: string; bill?: number | null };
export type ImportRow = { name: string; email?: string; phone?: string; source?: string; locationId?: string | null; visits?: ImportVisit[] };
export type ImportResult = { error: string | null; imported: number; skipped: number };

// Bulk-import guests from a mapped CSV. Each row becomes a guest; any mapped
// visit dates (visits 1–4) also create those visits — with the incentive and
// notes for each — so imported guests enter the bounce-back funnel dated
// correctly. Each row can carry its own location (resolved by the caller from a
// mapped column); rows without one fall back to `fallbackLocationId`. Rows
// without a name are skipped.
export async function importGuests(rows: ImportRow[], fallbackLocationId: string | null): Promise<ImportResult> {
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Nothing to import.", imported: 0, skipped: 0 };
  if (rows.length > 1000) return { error: "Import up to 1000 guests at a time.", imported: 0, skipped: 0 };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").single();
  if (!org) return { error: "Organization not found.", imported: 0, skipped: 0 };

  // The set of location ids actually in this org — any id not in it is ignored.
  const { data: orgLocs } = await supabase.from("locations").select("id").eq("org_id", org.id);
  const validLoc = new Set(((orgLocs ?? []) as { id: string }[]).map((l) => l.id));
  const fallback = fallbackLocationId && validLoc.has(fallbackLocationId) ? fallbackLocationId : null;

  const dateOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const guestRows: { org_id: string; name: string; email: string; phone: string; source: string }[] = [];
  const rowLoc: (string | null)[] = [];
  const rowVisits: ImportVisit[][] = [];
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
    rowLoc.push(r.locationId && validLoc.has(r.locationId) ? r.locationId : fallback);
    // Keep only valid, in-range visits (dedupe by visit number, last wins).
    const byN = new Map<number, ImportVisit>();
    for (const v of r.visits ?? []) {
      const d = (v?.date || "").trim();
      if (v && v.n >= 1 && v.n <= 4 && dateOk(d)) {
        const bill = v.bill != null && Number.isFinite(Number(v.bill)) && Number(v.bill) >= 0 ? Number(v.bill) : null;
        byN.set(v.n, { n: v.n, date: d, incentive: (v.incentive || "").slice(0, 300), notes: (v.notes || "").slice(0, 1000), bill });
      }
    }
    rowVisits.push([...byN.values()]);
  }
  if (guestRows.length === 0) return { error: null, imported: 0, skipped };

  // A single multi-row INSERT ... RETURNING preserves input order, so we can zip
  // the returned ids back to each row's visits + location.
  const { data: inserted, error } = await supabase.from("guests").insert(guestRows).select("id");
  if (error) return { error: error.message, imported: 0, skipped };
  const ids = ((inserted ?? []) as { id: string }[]).map((g) => g.id);

  const visits = ids.flatMap((id, i) =>
    (rowVisits[i] ?? []).map((v) => ({
      guest_id: id,
      org_id: org.id,
      visit_number: v.n,
      visit_date: v.date,
      location_id: rowLoc[i],
      incentive: v.incentive ?? "",
      notes: v.notes ?? "",
      bill_total: v.bill ?? null,
    }))
  );
  if (visits.length > 0) {
    await supabase.from("guest_visits").upsert(visits as object[], { onConflict: "guest_id,visit_number" });
  }

  revalidatePath("/bounceback");
  revalidatePath("/dashboard");
  return { error: null, imported: ids.length, skipped };
}

// Soft delete — the guest is hidden (RLS filters deleted_at) but recoverable by
// the owner from Settings → Trash. The action is recorded to the audit log.
export async function deleteGuest(guestId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: g } = await supabase.from("guests").select("name").eq("id", guestId).maybeSingle();
  await supabase
    .from("guests")
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile?.userId ?? null })
    .eq("id", guestId);
  if (profile) {
    await logAudit({
      orgId: profile.orgId,
      actorId: profile.userId,
      actorName: profile.fullName,
      action: "deleted",
      entityType: "guest",
      entityId: guestId,
      entityLabel: (g as { name?: string } | null)?.name ?? "",
    });
    await logActivity({ orgId: profile.orgId, actorId: profile.userId, actorName: profile.fullName, area: "guests", action: "deleted", label: (g as { name?: string } | null)?.name ?? "" });
  }
  revalidatePath("/bounceback");
  revalidatePath("/dashboard");
}
