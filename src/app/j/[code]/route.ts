import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Short link for a job opening: /j/<code>. Counts the click and redirects to the
// opening's pre-filled apply form (role + location set, tagged to the opening),
// so an operator can post one short, branded URL on Indeed/Craigslist/social and
// see how many people clicked it. Unknown codes fall back to the homepage; a
// closed opening still lands on the org's apply page (no dead link).
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const origin = request.nextUrl.origin;
  const home = NextResponse.redirect(new URL("/", origin));

  const admin = createAdminClient();
  const { data: op } = await admin
    .from("job_openings")
    .select("id, org_id, status, click_count")
    .eq("code", code)
    .maybeSingle();
  const opening = op as { id: string; org_id: string; status: string; click_count: number | null } | null;
  if (!opening) return home;

  const { data: orgRow } = await admin.from("organizations").select("public_slug").eq("id", opening.org_id).maybeSingle();
  const slug = (orgRow as { public_slug: string | null } | null)?.public_slug ?? null;
  if (!slug) return home;

  // Count the click (best-effort; a tiny undercount under simultaneous clicks is
  // fine for posting analytics).
  await admin.from("job_openings").update({ click_count: (opening.click_count ?? 0) + 1 }).eq("id", opening.id);

  const target = opening.status === "open" ? `/apply/${slug}?opening=${opening.id}` : `/apply/${slug}`;
  return NextResponse.redirect(new URL(target, origin));
}
