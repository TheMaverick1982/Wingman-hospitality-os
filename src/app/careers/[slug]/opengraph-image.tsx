import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { INTER_500, INTER_700, INTER_900 } from "@/lib/social-cards/fonts-data";
import { planeDataUri } from "@/lib/social-cards/plane";

export const alt = "Now hiring";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function b64(s: string): ArrayBuffer {
  const buf = Buffer.from(s, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function titleSize(len: number): number {
  if (len <= 22) return 88;
  if (len <= 34) return 72;
  if (len <= 48) return 60;
  return 50;
}

const BRICK = "#B4491F";

// Branded social-share card for a restaurant's public careers page — their logo
// (when set) plus "Now hiring at <Name>", so a link posted to Facebook/LinkedIn
// shows their brand, not a generic card. Light background so any logo reads.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let name = "our team";
  let logoUrl: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("organizations").select("name, logo_url").eq("public_slug", slug).maybeSingle();
    const org = data as { name: string; logo_url: string | null } | null;
    if (org) {
      name = org.name;
      logoUrl = org.logo_url;
    }
  } catch {
    // fall back to the generic card
  }
  const title = `Careers at ${name}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFFFF", padding: 80, position: "relative" }}>
        <div style={{ position: "absolute", top: -160, right: -120, width: 440, height: 440, borderRadius: 440, background: BRICK, opacity: 0.1, filter: "blur(30px)", display: "flex" }} />

        {/* Logo or initial */}
        <div style={{ display: "flex", alignItems: "center", height: 96 }}>
          {logoUrl ? (
            <img src={logoUrl} height={88} alt="" style={{ objectFit: "contain", maxWidth: 460 }} />
          ) : (
            <div style={{ display: "flex", width: 88, height: 88, borderRadius: 22, background: "#0A0A0A", color: "#fff", fontSize: 46, fontWeight: 900, alignItems: "center", justifyContent: "center" }}>
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: BRICK, letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>Now hiring</div>
        <div style={{ display: "flex", fontSize: titleSize(title.length), fontWeight: 900, color: "#111111", lineHeight: 1.05, letterSpacing: -1.5 }}>{title}</div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: "#6b6b6b", marginTop: 22 }}>See open positions by location and apply in minutes.</div>

        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img width={30} height={30} src={planeDataUri(BRICK)} alt="" />
          <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#8a8a8a" }}>Hiring powered by Wingman · joinwingman.app</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: b64(INTER_500), weight: 500, style: "normal" },
        { name: "Inter", data: b64(INTER_700), weight: 700, style: "normal" },
        { name: "Inter", data: b64(INTER_900), weight: 900, style: "normal" },
      ],
    },
  );
}
