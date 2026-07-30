import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { gpConfigured, gpIsSandbox, gpApiVersion, gpClientTokenizeToken, billingProvider, heartlandBrowserPublicKey } from "@/lib/global-payments";

// Provides the browser card form what it needs to tokenize a card, per provider:
//   - Heartland/Portico: the publishable public key (pkapi_…) — the SecureSubmit
//     library tokenizes client-side with it; no server token is minted.
//   - GP-API: a server-minted access token scoped to single-use tokenization only
//     (PMT_POST_Create_Single) — it cannot move money.
// Either way nothing returned here can charge a card. Owner-only.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.accessRole !== "super_admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  if (!gpConfigured()) return NextResponse.json({ error: "Card processing is not configured." }, { status: 400 });

  const provider = billingProvider();
  const env = gpIsSandbox() ? "sandbox" : "production";

  if (provider === "heartland") {
    const publicKey = heartlandBrowserPublicKey();
    if (!publicKey) return NextResponse.json({ error: "Heartland public key is not configured (HEARTLAND_PUBLIC_KEY)." }, { status: 400 });
    return NextResponse.json({ provider, env, publicKey });
  }

  try {
    const token = await gpClientTokenizeToken();
    return NextResponse.json({ provider, token, env, apiVersion: gpApiVersion() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create a client token." }, { status: 502 });
  }
}
