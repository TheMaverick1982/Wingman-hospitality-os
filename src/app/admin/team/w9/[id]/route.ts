import { NextResponse } from "next/server";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedW9Url } from "@/lib/w9";

// Redirect an authorized Team admin to a short-lived signed URL for a stored
// W-9. Access is gated on the Team section; the file lives in a private bucket.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await platformSectionActor("team");
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("w9_file_path").eq("id", id).maybeSingle();
  const path = (data as { w9_file_path: string | null } | null)?.w9_file_path;
  if (!path) return NextResponse.json({ error: "No W-9 on file" }, { status: 404 });

  const url = await signedW9Url(path);
  if (!url) return NextResponse.json({ error: "Could not generate link" }, { status: 500 });
  return NextResponse.redirect(url);
}
