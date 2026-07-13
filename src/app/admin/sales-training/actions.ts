"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { payableDateFrom } from "@/lib/sales-commissions";
import { provisionDemoSandbox } from "@/lib/demo/reseed";

// Must match the impersonation cookie used by the shared exit action + banner
// (src/app/admin/organizations/actions.ts) — that's how a sales agent returns
// to their platform account after running a demo.
const IMPERSONATOR_COOKIE = "wingman_impersonator_refresh";

// Let a platform sales agent step into a PRIVATE, per-rep demo sandbox to run a
// live demo for a prospect, then step back to their own account via the existing
// impersonation banner.
//
// Each entry provisions a brand-new, fully-isolated org (throwaway user + fresh
// seeded showcase) instead of the shared master. That means any number of reps
// can run demos at the same time without stepping on each other's data, and
// anything the rep edits mid-demo evaporates when the sandbox auto-expires
// (reaped by /api/cron/demo-cleanup ~3h later). No reseed needed — it's born clean.
export async function enterDemoAsStaff() {
  const actor = await platformSectionActor("sales_training");
  if (!actor) throw new Error("You don't have sales access.");

  const supabase = await createClient();
  const {
    data: { session: mySession },
  } = await supabase.auth.getSession();

  // Fresh isolated sandbox for this rep. Stamp their identity as the "lead" so
  // a sandbox can be traced back to the rep who opened it.
  const { email } = await provisionDemoSandbox({ leadEmail: actor.email, leadName: actor.fullName });

  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !linkData) throw new Error("Couldn't open the demo. Try again.");

  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });
  if (verifyError) throw new Error("Couldn't start the demo session.");

  // Stash the agent's own session so the "exit" banner returns them here.
  const cookieStore = await cookies();
  if (mySession?.refresh_token) {
    cookieStore.set(IMPERSONATOR_COOKIE, mySession.refresh_token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  }

  redirect("/dashboard");
}

// nonce increments on each successful claim so the form can remount + clear.
export type ClaimState = { error: string | null; ok: boolean; nonce: number };

// A sales rep claims a commission for an account they closed. The claim always
// belongs to the logged-in rep (they can't claim for someone else) and lands as
// 'pending' for the owner to approve or deny — so nothing counts until it's been
// checked. Gated on the sales_training section, which reps have.
export async function claimCommission(prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const nonce = prev.nonce ?? 0;
  const fail = (error: string): ClaimState => ({ error, ok: false, nonce });

  const actor = await platformSectionActor("sales_training");
  if (!actor) return fail("Not authorized.");

  const kind = String(formData.get("kind") || "");
  if (!["activation", "tail", "other"].includes(kind)) return fail("Pick a commission type.");

  const dollars = Number(formData.get("amount"));
  if (!Number.isFinite(dollars) || dollars < 0) return fail("Enter a valid dollar amount.");
  const amount_cents = Math.round(dollars * 100);

  const label = String(formData.get("label") || "").trim();
  if (!label) return fail("Add a short label (e.g. the account name).");

  const orgId = String(formData.get("org_id") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  const admin = createAdminClient();
  const { error } = await admin.from("sales_commissions").insert({
    rep_profile_id: actor.userId, // always the claiming rep
    org_id: orgId,
    kind,
    label,
    amount_cents,
    status: "pending", // awaits owner approval
    note,
    payable_on: payableDateFrom(Date.now()), // policy default; owner can adjust
    created_by: actor.userId,
  });
  if (error) return fail(error.message);

  revalidatePath("/admin/sales-training");
  revalidatePath("/admin/sales-commissions");
  return { error: null, ok: true, nonce: nonce + 1 };
}
