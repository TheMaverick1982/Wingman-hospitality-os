import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { authDialogUrl, metaConfigured } from "@/lib/social-meta";

// Kick off the Meta OAuth flow. Platform-admin only; sets a CSRF state cookie
// and redirects to the Facebook login dialog.
export async function GET(request: NextRequest) {
  if (!(await platformSectionActor("social"))) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (!metaConfigured()) {
    return NextResponse.redirect(new URL("/admin/social?meta=unconfigured", request.url));
  }
  const state = randomUUID();
  const jar = await cookies();
  jar.set("meta_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(authDialogUrl(state));
}
