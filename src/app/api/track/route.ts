import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/rate-limit";
import { VISITOR_COOKIE } from "@/lib/visitor";

// First-party page-view beacon. Records the path a visitor viewed, keyed by a
// first-party cookie we set here (httpOnly — the browser never reads it). No PII,
// no third parties. Best-effort: always returns 204 so it never surfaces an error
// to the visitor.
export const maxDuration = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clip(v: unknown, n: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;
}

export async function POST(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (!(await consumeRateLimit(`track:${ip}`, 300, 3600))) return res;

  const body = (await request.json().catch(() => null)) as {
    path?: string;
    referrer?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  } | null;
  const path = clip(body?.path, 300);
  if (!path || !path.startsWith("/")) return res; // first-party paths only

  // Reuse the existing visitor cookie, or mint one and set it.
  let vid = (await cookies()).get(VISITOR_COOKIE)?.value ?? "";
  if (!UUID_RE.test(vid)) {
    vid = randomUUID();
    res.cookies.set(VISITOR_COOKIE, vid, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  try {
    const admin = createAdminClient();
    await admin.from("site_page_views").insert({
      visitor_id: vid,
      path,
      referrer: clip(body?.referrer, 500),
      utm_source: clip(body?.utm_source, 120),
      utm_medium: clip(body?.utm_medium, 120),
      utm_campaign: clip(body?.utm_campaign, 160),
    });
  } catch (e) {
    console.error("[track] insert failed", e);
  }
  return res;
}
