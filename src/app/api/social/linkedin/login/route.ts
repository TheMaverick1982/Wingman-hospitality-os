import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { linkedinAuthUrl, linkedinConfigured } from "@/lib/social-linkedin";

// Start the LinkedIn OAuth flow. Platform-admin only; sets a CSRF state cookie
// and redirects to LinkedIn's authorization dialog.
export async function GET(request: NextRequest) {
  if (!(await platformSectionActor("social"))) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (!linkedinConfigured()) {
    return NextResponse.redirect(new URL("/admin/social?li=unconfigured", request.url));
  }
  const state = randomUUID();
  const jar = await cookies();
  jar.set("li_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(linkedinAuthUrl(state));
}
