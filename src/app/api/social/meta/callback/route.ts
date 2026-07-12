import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { completeOAuth } from "@/lib/social-meta";

// Meta OAuth callback. Verifies the CSRF state, exchanges the code for the Page
// token + linked IG account, and stores the connection. Redirects back to the
// Social planner with a status flag.
export async function GET(request: NextRequest) {
  const actor = await platformSectionActor("social");
  if (!actor) return NextResponse.redirect(new URL("/admin", request.url));

  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  if (err) return NextResponse.redirect(new URL("/admin/social?meta=denied", request.url));

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get("meta_oauth_state")?.value;
  jar.delete("meta_oauth_state");
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/admin/social?meta=badstate", request.url));
  }

  const result = await completeOAuth(code, actor.userId);
  if (result.error) {
    return NextResponse.redirect(new URL(`/admin/social?meta=error&msg=${encodeURIComponent(result.error)}`, request.url));
  }
  return NextResponse.redirect(new URL("/admin/social?meta=connected", request.url));
}
