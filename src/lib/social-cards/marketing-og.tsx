import { ImageResponse } from "next/og";
import { INTER_500, INTER_700, INTER_900 } from "@/lib/social-cards/fonts-data";
import { planeDataUri } from "@/lib/social-cards/plane";

// One branded social-share card for the marketing/funnel pages, so a link posted
// to LinkedIn/Facebook/X/Slack previews with the page's own promise instead of a
// single generic image. Each page's opengraph-image.tsx supplies the copy.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BRICK = "#B4491F";
const BRICK_SOFT = "#E06A3B";

function b64(s: string): ArrayBuffer {
  const buf = Buffer.from(s, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function titleSize(len: number): number {
  if (len <= 30) return 72;
  if (len <= 48) return 62;
  if (len <= 68) return 54;
  return 46;
}

export function marketingOg({ eyebrow, title, subtitle, footer }: { eyebrow: string; title: string; subtitle?: string; footer?: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0A0A0A", padding: 76, position: "relative" }}>
        <div style={{ position: "absolute", top: -170, right: -130, width: 470, height: 470, borderRadius: 470, background: BRICK, opacity: 0.2, filter: "blur(50px)", display: "flex" }} />

        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders to PNG, not a DOM <img> */}
          <img width={52} height={52} src={planeDataUri(BRICK_SOFT)} alt="" />
          <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#ffffff" }}>Wingman</div>
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: BRICK_SOFT, letterSpacing: 2, textTransform: "uppercase", marginBottom: 22 }}>{eyebrow}</div>
        <div style={{ display: "flex", fontSize: titleSize(title.length), fontWeight: 900, color: "#ffffff", lineHeight: 1.05, letterSpacing: -1.6, maxWidth: 1010 }}>{title}</div>
        {subtitle && <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: "#b8b8b8", marginTop: 22, maxWidth: 980, lineHeight: 1.3 }}>{subtitle}</div>}

        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#8a8a8a" }}>The retention layer for hospitality</div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#8a8a8a" }}>{footer ?? "joinwingman.app"}</div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Inter", data: b64(INTER_500), weight: 500, style: "normal" },
        { name: "Inter", data: b64(INTER_700), weight: 700, style: "normal" },
        { name: "Inter", data: b64(INTER_900), weight: 900, style: "normal" },
      ],
    },
  );
}
