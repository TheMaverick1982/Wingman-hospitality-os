import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { gpConfigured, gpIsSandbox, gpApiVersion, gpClientTokenizeToken } from "@/lib/global-payments";

// Mints a browser-scoped Global Payments access token for the hosted-fields
// card form. The token can ONLY create single-use card tokens (permission
// PMT_POST_Create_Single) — it cannot move money — so returning it to the
// owner's browser is safe. Owner-only.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  if (!gpConfigured()) return NextResponse.json({ error: "Global Payments is not configured." }, { status: 400 });
  try {
    const token = await gpClientTokenizeToken();
    return NextResponse.json({
      token,
      env: gpIsSandbox() ? "sandbox" : "production",
      apiVersion: gpApiVersion(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create a client token." }, { status: 502 });
  }
}
