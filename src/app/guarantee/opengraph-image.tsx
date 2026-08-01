import { ImageResponse } from "next/og";
import { INTER_500, INTER_700, INTER_900 } from "@/lib/social-cards/fonts-data";
import { planeDataUri } from "@/lib/social-cards/plane";

// Social-share card for the (unindexed) /guarantee landing page. The page is
// noindex, but link scrapers (iMessage, Slack, LinkedIn, X, Facebook) still read
// these tags when the private URL is pasted — so a shared link previews with the
// offer's promise instead of a bare URL. Next auto-wires this into both the
// Open Graph and Twitter image slots for the route.
export const alt =
  "The Retention Guarantee — turn first-time guests into regulars in 90 days, or you stop paying until you do.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function b64(s: string): ArrayBuffer {
  const buf = Buffer.from(s, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export default function Image() {
  const accent = "#0a6cff";
  const accentSoft = "#4D97FF";
  const green = "#22c55e";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0A0A0A",
          padding: 76,
          position: "relative",
        }}
      >
        {/* soft brand glow */}
        <div
          style={{
            position: "absolute",
            top: -170,
            right: -130,
            width: 470,
            height: 470,
            borderRadius: 470,
            background: accent,
            opacity: 0.18,
            filter: "blur(50px)",
            display: "flex",
          }}
        />

        {/* header: wordmark + guarantee chip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img width={56} height={56} src={planeDataUri(accentSoft)} alt="" />
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#ffffff" }}>Wingman</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 999,
              padding: "11px 22px",
            }}
          >
            <div style={{ width: 11, height: 11, borderRadius: 11, background: green, display: "flex" }} />
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "#ffffff", letterSpacing: 1 }}>
              90-DAY GUARANTEE
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            color: accentSoft,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 22,
          }}
        >
          The Retention Guarantee
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 66,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1.05,
            letterSpacing: -1.8,
            maxWidth: 1000,
          }}
        >
          Turn first-time guests into regulars in 90 days.
        </div>
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: green, marginTop: 22 }}>
          Or you stop paying until you do.
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#8a8a8a" }}>
            The Full House Install · 10 founding groups
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#8a8a8a" }}>
            joinwingman.app/guarantee
          </div>
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
