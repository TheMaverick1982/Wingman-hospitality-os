"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { revokeToken, squareGet, SQUARE_SCOPES, squareSandboxTokenAvailable, squareSandboxToken } from "@/lib/square";
import { syncSquareOrg } from "@/lib/square-sync";

async function owner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return null;
  return profile;
}

export async function disconnectSquare(): Promise<{ error: string | null }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage integrations." };
  const admin = createAdminClient();
  const { data: conn } = await admin.from("square_connections").select("access_token").eq("org_id", profile.orgId).maybeSingle();
  if (conn?.access_token) await revokeToken((conn as { access_token: string }).access_token);
  await admin.from("square_connections").delete().eq("org_id", profile.orgId);
  revalidatePath("/settings");
  return { error: null };
}

// Testing path: connect using the sandbox test-merchant access token instead of
// the browser OAuth flow (useful when Square's sandbox authorize page is down).
// Sandbox-only; creates the connection row, then runs a sync immediately.
export async function connectSquareSandboxToken(): Promise<{ error: string | null; guests: number; salesCents: number }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can connect.", guests: 0, salesCents: 0 };
  if (!squareSandboxTokenAvailable()) return { error: "No sandbox access token is configured.", guests: 0, salesCents: 0 };
  const token = squareSandboxToken();

  let merchantId = "";
  try {
    const d = await squareGet<{ merchant?: { id: string }[] }>("/v2/merchants", token);
    merchantId = d.merchant?.[0]?.id ?? "";
  } catch {
    /* best-effort; merchant id isn't required */
  }

  const admin = createAdminClient();
  await admin.from("square_connections").upsert(
    {
      org_id: profile.orgId,
      merchant_id: merchantId,
      access_token: token,
      refresh_token: "",
      token_expires_at: null,
      scopes: SQUARE_SCOPES,
      connected_by: profile.userId,
      connected_at: new Date().toISOString(),
      last_sync_status: null,
    },
    { onConflict: "org_id" }
  );

  const res = await syncSquareOrg(profile.orgId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return res;
}

export async function syncSquareNow(): Promise<{ error: string | null; guests: number; salesCents: number }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can sync.", guests: 0, salesCents: 0 };
  const res = await syncSquareOrg(profile.orgId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return res;
}
