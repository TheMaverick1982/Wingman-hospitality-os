import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSectionAccess } from "@/lib/auth/permissions";
import { completeGbpOAuth } from "@/lib/google-business";

// Finish the Google Business Profile OAuth flow: verify CSRF state, exchange the
// code, store the connection for this org, and return to Guest Reviews.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const jar = await cookies();
  const expected = jar.get("gbp_oauth_state")?.value;
  jar.delete("gbp_oauth_state");

  const back = (q: string) => NextResponse.redirect(new URL(`/reviews?${q}`, request.url));

  if (err) return back(`g=denied`);
  if (!code || !state || !expected || state !== expected) return back(`g=error`);

  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", request.url));
  if (getSectionAccess(profile.accessRole, "reviews", profile.permissionOverrides) !== "full") return back(`g=error`);

  const res = await completeGbpOAuth(code, profile.orgId, profile.userId);
  if (res.error) return back(`g=error`);
  return back(`connected=1`);
}
