import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAffiliateSettings, REF_COOKIE } from "@/lib/affiliate";

// Referral link entry point: /r/<code>. Logs the click, sets a first-click
// attribution cookie (never overwriting an existing one), and sends the visitor
// to the homepage. Unknown/inactive codes just redirect silently.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Optional post-attribution destination (e.g. an embed's "Get Started" → set
  // the cookie, then land on /signup). Only same-origin absolute paths are
  // allowed — never "//host" or an external URL — so this can't be an open
  // redirect.
  const toRaw = request.nextUrl.searchParams.get("to") || "/";
  const to = toRaw.startsWith("/") && !toRaw.startsWith("//") ? toRaw : "/";
  const res = NextResponse.redirect(new URL(to, request.nextUrl.origin));

  const admin = createAdminClient();
  const { data: aff } = await admin
    .from("affiliates")
    .select("id, status, cookie_days")
    .eq("code", code)
    .maybeSingle();

  const affiliate = aff as { id: string; status: string; cookie_days: number | null } | null;
  if (!affiliate || affiliate.status !== "approved") return res;

  // Log the click (analytics).
  await admin.from("affiliate_clicks").insert({
    affiliate_id: affiliate.id,
    referrer: request.headers.get("referer"),
  });

  // First-click wins: only set the cookie if the visitor doesn't already carry
  // one from an earlier affiliate.
  if (!request.cookies.get(REF_COOKIE)) {
    const settings = await getAffiliateSettings(admin);
    const days = affiliate.cookie_days ?? settings.default_cookie_days;
    res.cookies.set(REF_COOKIE, code, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: days * 24 * 60 * 60,
    });
  }

  return res;
}
