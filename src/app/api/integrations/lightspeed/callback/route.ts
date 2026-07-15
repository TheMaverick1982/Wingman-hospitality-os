import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeLightspeedCode } from "@/lib/lightspeed";

// Lightspeed redirects here after the owner consents. We verify the CSRF `state`
// cookie, exchange the short-lived code for a token pair, and link the account to
// the signed-in owner's org. The token is a secret handled only server-side.
export async function GET(request: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const jar = await cookies();
  const savedState = jar.get("lightspeed_oauth_state")?.value;
  jar.delete("lightspeed_oauth_state");

  const settings = `${base}/settings?tab=api`;
  if (err) return NextResponse.redirect(`${settings}&lightspeed=denied`);
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${settings}&lightspeed=badstate`);
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return NextResponse.redirect(`${base}/settings`);

  try {
    const token = await exchangeLightspeedCode(code);
    if (!token.access_token) throw new Error("no access token");

    // Lightspeed returns an account context; the API base is generic, so we key
    // on whatever account identifier the token flow provides. Fall back to the
    // org id so a single-account operator still gets one stable row.
    const accountId = url.searchParams.get("account_id") ?? url.searchParams.get("systemCustomerID") ?? profile.orgId;

    const admin = createAdminClient();
    await admin.from("lightspeed_connections").upsert(
      {
        org_id: profile.orgId,
        account_id: accountId,
        account_name: "",
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_expires_at: token.access_expires_at,
        scopes: "",
        connected_by: profile.userId,
        connected_at: new Date().toISOString(),
        last_sync_status: null,
      },
      { onConflict: "org_id,account_id" },
    );
    return NextResponse.redirect(`${settings}&lightspeed=connected`);
  } catch (e) {
    console.error("lightspeed callback failed", e);
    return NextResponse.redirect(`${settings}&lightspeed=error`);
  }
}
