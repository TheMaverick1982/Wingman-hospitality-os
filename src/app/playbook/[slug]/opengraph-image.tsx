import { ImageResponse } from "next/og";
import { getBySlugAny } from "@/lib/playbook";
import { INTER_500, INTER_700, INTER_900 } from "@/lib/social-cards/fonts-data";
import { planeDataUri } from "@/lib/social-cards/plane";

export const alt = "The Playbook — Wingman";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function b64(s: string): ArrayBuffer {
  const buf = Buffer.from(s, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function titleSize(len: number): number {
  if (len <= 40) return 76;
  if (len <= 70) return 64;
  if (len <= 100) return 54;
  return 46;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBySlugAny(slug).catch(() => null);
  const title = post?.title ?? "The Playbook";
  const category = post?.category ?? "For restaurant operators";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0A0A0A", padding: 80, position: "relative" }}>
        <div style={{ position: "absolute", top: -160, right: -120, width: 420, height: 420, borderRadius: 420, background: "#0a6cff", opacity: 0.18, filter: "blur(40px)", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img width={64} height={64} src={planeDataUri("#0a6cff")} alt="" />
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#4D97FF", letterSpacing: 2, textTransform: "uppercase" }}>The Playbook</div>
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#4D97FF", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 24 }}>{category}</div>
        <div style={{ display: "flex", fontSize: titleSize(title.length), fontWeight: 900, color: "#ffffff", lineHeight: 1.08, letterSpacing: -1.5 }}>{title}</div>

        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#ffffff" }}>Wingman</div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: "#8a8a8a" }}>joinwingman.app</div>
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
