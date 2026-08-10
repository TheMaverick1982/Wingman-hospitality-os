"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { lookupHost, verifyToken } from "@/lib/heartland-retail";
import { syncHeartland } from "@/lib/heartland-retail-sync";

async function owner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return null;
  return profile;
}

// Connect a Heartland Retail account with a user access token. Heartland's OAuth
// is closed, so the owner generates a token in Heartland Retail and pastes it
// here. We resolve the account's subdomain (host) once, verify the token via
// whoami (which also gives us the account name), then store the connection. The
// token is a SECRET — stored server-side only, never selected to the browser.
export async function connectHeartland(tokenRaw: string): Promise<{ error: string | null; name?: string }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage integrations." };
  const token = tokenRaw.trim();
  if (!token) return { error: "Paste your Heartland Retail access token." };

  const host = await lookupHost(token);
  if (!host) return { error: "Couldn't look up your Heartland account — double-check the access token." };

  const { valid, name } = await verifyToken(token, host);
  if (!valid) return { error: "That token was rejected by Heartland — check that it's valid and has the right access." };

  const admin = createAdminClient();
  await admin.from("heartland_retail_connections").upsert(
    {
      org_id: profile.orgId,
      account_host: host,
      account_name: name,
      access_token: token,
      connected_by: profile.userId,
      connected_at: new Date().toISOString(),
      last_sync_status: null,
    },
    { onConflict: "org_id,account_host" },
  );

  // First pull right away so the owner sees data immediately.
  const res = await syncHeartland(profile.orgId, host);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return { error: res.error, name: name || host };
}

// Disconnect a single Heartland Retail account. Removing our record (and its
// stored token) is all that's needed.
export async function disconnectHeartland(host: string): Promise<{ error: string | null }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can manage integrations." };
  const admin = createAdminClient();
  await admin.from("heartland_retail_connections").delete().eq("org_id", profile.orgId).eq("account_host", host);
  revalidatePath("/settings");
  return { error: null };
}

export async function syncHeartlandNow(host: string): Promise<{ error: string | null; guests: number; salesCents: number }> {
  const profile = await owner();
  if (!profile) return { error: "Only the account owner can sync.", guests: 0, salesCents: 0 };
  const res = await syncHeartland(profile.orgId, host);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/bounceback");
  return res;
}
