import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { completeLinkedInOAuth } from "@/lib/social-linkedin";

// LinkedIn OAuth callback. Verifies CSRF state, exchanges the code for a token +
// the member identity, stores it, and returns to the Social planner.
export async function GET(request: NextRequest) {
  const actor = await platformSectionActor("social");
  if (!actor) return NextResponse.redirect(new URL("/admin", request.url));

  const url = new URL(request.url);
  if (url.searchParams.get("error")) return NextResponse.redirect(new URL("/admin/social?li=denied", request.url));

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get("li_oauth_state")?.value;
  jar.delete("li_oauth_state");
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/admin/social?li=badstate", request.url));
  }

  const result = await completeLinkedInOAuth(code, actor.userId);
  if (result.error) {
    return NextResponse.redirect(new URL(`/admin/social?li=error&msg=${encodeURIComponent(result.error)}`, request.url));
  }
  return NextResponse.redirect(new URL("/admin/social?li=connected", request.url));
}
