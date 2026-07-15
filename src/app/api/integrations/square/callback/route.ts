import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForToken, SQUARE_SCOPES } from "@/lib/square";

// Square redirects here after consent. We verify the CSRF state, exchange the
// code for a token, and store the connection (service role — the token is a
// secret and never touches the browser).
export async function GET(request: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app").replace(/\/$/, "");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const jar = await cookies();
  const savedState = jar.get("square_oauth_state")?.value;
  jar.delete("square_oauth_state");

  const settings = `${base}/settings?tab=api`;
  if (err) return NextResponse.redirect(`${settings}&square=denied`);
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${settings}&square=badstate`);
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") return NextResponse.redirect(`${base}/settings`);

  try {
    const token = await exchangeCodeForToken(code);
    if (!token.access_token) throw new Error("no access token");
    const admin = createAdminClient();
    await admin.from("square_connections").upsert(
      {
        org_id: profile.orgId,
        merchant_id: token.merchant_id,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_expires_at: token.expires_at,
        scopes: SQUARE_SCOPES,
        connected_by: profile.userId,
        connected_at: new Date().toISOString(),
        last_sync_status: null,
      },
      { onConflict: "org_id" }
    );
    return NextResponse.redirect(`${settings}&square=connected`);
  } catch (e) {
    console.error("square callback failed", e);
    return NextResponse.redirect(`${settings}&square=error`);
  }
}
