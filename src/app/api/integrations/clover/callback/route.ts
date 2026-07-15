import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCloverCode, cloverGet } from "@/lib/clover";

// Clover redirects here after consent with `code`, `merchant_id`, and our
// `state`. We verify CSRF, exchange the code, look up the merchant name (for
// per-location mapping), and store the connection (service role — the token is
// a secret and never touches the browser). One row per store (merchant).
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
  if (!code || !state || !savedState || state !== savedState || !merchantId) {
    return NextResponse.redirect(`${settings}&clover=badstate`);
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return NextResponse.redirect(`${base}/settings`);

  try {
    const token = await exchangeCloverCode(code);
    if (!token.access_token) throw new Error("no access token");

    // Best-effort merchant name for location matching.
    let merchantName = "";
    try {
      const m = await cloverGet<{ name?: string }>(`/v3/merchants/${merchantId}`, token.access_token);
      merchantName = (m.name ?? "").trim();
    } catch {
      /* name is optional; sales just roll up org-wide without it */
    }

    const admin = createAdminClient();
    await admin.from("clover_connections").upsert(
      {
        org_id: profile.orgId,
        merchant_id: merchantId,
        merchant_name: merchantName,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_expires_at: token.access_expires_at,
        refresh_expires_at: token.refresh_expires_at,
        scopes: "",
        connected_by: profile.userId,
        connected_at: new Date().toISOString(),
        last_sync_status: null,
      },
      { onConflict: "org_id,merchant_id" },
    );
    return NextResponse.redirect(`${settings}&clover=connected`);
  } catch (e) {
    console.error("clover callback failed", e);
    return NextResponse.redirect(`${settings}&clover=error`);
  }
}
