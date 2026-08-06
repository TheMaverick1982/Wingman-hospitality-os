"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { guardPublicForm } from "@/lib/public-form-guard";
import { RATING_IDS } from "@/lib/guest-survey";

export type SurveyState = { error: string | null; ok?: boolean };

// Public guest survey submission (no auth). Spam-guarded, stored in the Guest
// Reviews archive. NEVER creates a Bounce Back guest; only match-links to one
// that already exists (by email/phone) so a known regular's feedback can show on
// their profile without adding anyone or counting a visit.
export async function submitSurvey(code: string, _prev: SurveyState, formData: FormData): Promise<SurveyState> {
  const guard = await guardPublicForm(formData, { rateKey: `survey:${code}`, max: 15, windowSeconds: 3600 });
  if (!guard.ok) {
    // Honeypot → pretend success so the bot gets no signal.
    return guard.reason === "honeypot" ? { error: null, ok: true } : { error: guard.message };
  }

  const admin = createAdminClient();
  const { data: linkRow } = await admin
    .from("guest_survey_links")
    .select("org_id, location_id")
    .eq("code", code)
    .maybeSingle();
  const link = linkRow as { org_id: string; location_id: string } | null;
  if (!link) return { error: "This survey link is no longer active." };

  // Ratings (1–5) for each rating question.
  const ratings: Record<string, number> = {};
  for (const id of RATING_IDS) {
    const n = parseInt(String(formData.get(`rating_${id}`) ?? ""), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 5) ratings[id] = n;
  }
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 2000);
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 200);

  if (Object.keys(ratings).length === 0 && !comment) {
    return { error: "Please rate your visit or leave a comment before submitting." };
  }

  // Server they picked — validate it belongs to this org + location.
  let serverStaffId: string | null = null;
  const rawServer = String(formData.get("server_staff_id") ?? "").trim();
  if (rawServer) {
    const { data: staff } = await admin
      .from("staff_members")
      .select("id")
      .eq("id", rawServer)
      .eq("org_id", link.org_id)
      .eq("location_id", link.location_id)
      .maybeSingle();
    if (staff) serverStaffId = rawServer;
  }

  // Match-ONLY link to an existing guest (never create). Match by email or phone
  // within this org.
  let matchedGuestId: string | null = null;
  if (contact) {
    const isEmail = contact.includes("@");
    const digits = contact.replace(/\D/g, "");
    let q = admin.from("guests").select("id").eq("org_id", link.org_id).limit(1);
    if (isEmail) q = q.ilike("email", contact);
    else if (digits.length >= 7) q = q.ilike("phone", `%${digits.slice(-7)}%`);
    else q = q.ilike("email", contact);
    const { data: g } = await q.maybeSingle();
    matchedGuestId = (g as { id: string } | null)?.id ?? null;
  }

  const { error } = await admin.from("guest_survey_responses").insert({
    org_id: link.org_id,
    location_id: link.location_id,
    server_staff_id: serverStaffId,
    ratings,
    comment,
    contact,
    matched_guest_id: matchedGuestId,
  });
  if (error) return { error: "Something went wrong submitting your feedback. Please try again." };

  return { error: null, ok: true };
}
