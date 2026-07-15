import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCloverCode, cloverGet } from "@/lib/clover";

// Clover redirects here in two situations:
//
//  1. Owner-initiated (from Settings → Connect Clover): we set a CSRF `state`
//     cookie and Clover returns the matching `state`. We link the store to the
//     signed-in owner's org immediately.
//
//  2. App-Market launch: the merchant installs Wingman from Clover and launches
//     it. Clover redirects with `merchant_id` + `code` but NO `state` and no
//     Wingman session. We exchange the code (it's short-lived), stash the token
//     as a pending install keyed by a nonce cookie, and send them to a welcome
//     page to sign in / sign up — the app shell finalizes the link after auth.
//
// The token is a secret and is only ever handled server-side (service role).
export async function GET(request: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const merchantId = url.searchParams.get("merchant_id") ?? "";
  const err = url.searchParams.get("error");

  const jar = await cookies();
  const savedState = jar.get("clover_oauth_state")?.value;
  jar.delete("clover_oauth_state");

  const settings = `${base}/settings?tab=api`;
  if (err) return NextResponse.redirect(`${settings}&clover=denied`);
  if (!code || !merchantId) return NextResponse.redirect(`${settings}&clover=badstate`);

  const ownerInitiated = Boolean(state && savedState && state === savedState);

  try {
    const token = await exchangeCloverCode(code);
    if (!token.access_token) throw new Error("no access token");

    // Best-effort merchant name (for per-location matching / display).
    let merchantName = "";
    try {
      const m = await cloverGet<{ name?: string }>(`/v3/merchants/${merchantId}`, token.access_token);
      merchantName = (m.name ?? "").trim();
    } catch {
      /* name is optional */
    }

    const admin = createAdminClient();

    // --- Case 2: App-Market launch (no owner session to attach to yet) ---
    if (!ownerInitiated) {
      const profile = await getCurrentProfile();
      if (!profile || profile.accessRole !== "super_admin") {
        // Stash the token as a pending install and hand off to the welcome page.
        const { data: pending } = await admin
          .from("clover_pending_installs")
          .insert({
            merchant_id: merchantId,
            merchant_name: merchantName,
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            token_expires_at: token.access_expires_at,
            refresh_expires_at: token.refresh_expires_at,
          })
          .select("id")
          .single();
        const nonce = (pending as { id?: string } | null)?.id ?? "";
        if (nonce) {
          jar.set("clover_pending", nonce, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 3600, path: "/" });
        }
        return NextResponse.redirect(`${base}/clover/welcome`);
      }
      // A Wingman owner happens to be signed in — link it straight to their org.
      await storeConnection(admin, profile.orgId, profile.userId, merchantId, merchantName, token);
      return NextResponse.redirect(`${settings}&clover=connected`);
    }

    // --- Case 1: Owner-initiated connect ---
    const profile = await getCurrentProfile();
    if (!profile || profile.accessRole !== "super_admin") return NextResponse.redirect(`${base}/settings`);
    await storeConnection(admin, profile.orgId, profile.userId, merchantId, merchantName, token);
    return NextResponse.redirect(`${settings}&clover=connected`);
  } catch (e) {
    console.error("clover callback failed", e);
    return NextResponse.redirect(`${settings}&clover=error`);
  }
}

type TokenLike = { access_token: string; refresh_token: string; access_expires_at: string | null; refresh_expires_at: string | null };

async function storeConnection(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string,
  merchantId: string,
  merchantName: string,
  token: TokenLike,
) {
  await admin.from("clover_connections").upsert(
    {
      org_id: orgId,
      merchant_id: merchantId,
      merchant_name: merchantName,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: token.access_expires_at,
      refresh_expires_at: token.refresh_expires_at,
      scopes: "",
      connected_by: userId,
      connected_at: new Date().toISOString(),
      last_sync_status: null,
    },
    { onConflict: "org_id,merchant_id" },
  );
}
