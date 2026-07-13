import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/error-monitor";

// Client-side error boundaries POST here. We attach the current user's org +
// email (server-verified, never trusted from the body) so an alert has real
// context, then hand off to the monitor. Always 204 — the client shouldn't care.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { message?: unknown; stack?: unknown; route?: unknown };
    const message = String(body.message ?? "").slice(0, 500);
    if (!message) return new NextResponse(null, { status: 204 });
    const stack = body.stack ? String(body.stack).slice(0, 4000) : undefined;
    const route = body.route ? String(body.route).slice(0, 300) : undefined;

    // Only record for a real, signed-in session (keeps the endpoint from being a
    // spam target). Resolve org + email server-side.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new NextResponse(null, { status: 204 });

    let orgId: string | null = null;
    const admin = createAdminClient();
    const { data: prof } = await admin.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
    orgId = (prof as { org_id: string } | null)?.org_id ?? null;

    const err = new Error(message);
    err.stack = stack;
    await reportError({ error: err, source: "client", route, orgId, userEmail: user.email ?? null });
  } catch (e) {
    console.error("[monitor] client report failed", e);
  }
  return new NextResponse(null, { status: 204 });
}
