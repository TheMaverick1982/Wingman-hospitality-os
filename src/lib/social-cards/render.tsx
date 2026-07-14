import { ImageResponse } from "next/og";
import { SCHEMES, type CardSpec, type Scheme } from "./schemes";
import { planeDataUri } from "./plane";
import { INTER_500, INTER_700, INTER_900 } from "./fonts-data";

// ── Fonts ───────────────────────────────────────────────────────────────────
// Inter, embedded as base64 (see fonts-data.ts) so the fonts are always in the
// bundle — no runtime file loading that could fail on a serverless function.
function b64(s: string): ArrayBuffer {
  const buf = Buffer.from(s, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}
let fontCache: { name: string; data: ArrayBuffer; weight: 500 | 700 | 900; style: "normal" }[] | null = null;
function fonts() {
  if (!fontCache) {
    fontCache = [
      { name: "Inter", data: b64(INTER_500), weight: 500, style: "normal" },
      { name: "Inter", data: b64(INTER_700), weight: 700, style: "normal" },
      { name: "Inter", data: b64(INTER_900), weight: 900, style: "normal" },
    ];
  }
  return fontCache;
}

// ── Auto-fit: pick a font size from text length so nothing clips ─────────────
function fit(text: string, steps: [max: number, size: number][], fallback: number): number {
  const len = (text ?? "").length;
  for (const [max, size] of steps) if (len <= max) return size;
  return fallback;
}

const PAD = 88;
const HANDLE = "@joinwingman";

// A flexible spacer that eats leftover vertical room (Satori-safe alternative to
// margin:auto), used to push content to the bottom of the card.
function Spacer() {
  return <div style={{ display: "flex", flexGrow: 1 }} />;
}
function Handle({ s }: { s: Scheme }) {
  return <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: s.handle, letterSpacing: 0.2, marginTop: 32 }}>{HANDLE}</div>;
}
function Plane({ s }: { s: Scheme }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img width={92} height={92} src={planeDataUri(s.plane)} alt="" />;
}

// Returns the ordered top-level children for a card of the given type. Every
// container that holds more than one child sets display:flex + a direction, and
// bottom-anchoring is done with an explicit <Spacer/> rather than auto margins.
function childrenFor(spec: CardSpec, s: Scheme): React.ReactNode[] {
  if (spec.type === "stat") {
    return [
      <Plane key="p" s={s} />,
      <Spacer key="sp" />,
      <div key="b" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: fit(spec.stat ?? "", [[6, 176], [10, 148], [16, 116]], 92), fontWeight: 900, color: s.accent, lineHeight: 1, letterSpacing: -3 }}>{spec.stat}</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: fit(spec.subhead ?? "", [[28, 60], [54, 52], [80, 44]], 38), fontWeight: 800, color: s.ink, lineHeight: 1.08, letterSpacing: -1 }}>{spec.subhead}</div>
        {spec.support ? <div style={{ display: "flex", marginTop: 22, fontSize: 30, fontWeight: 500, color: s.sub, lineHeight: 1.3 }}>{spec.support}</div> : null}
        <Handle s={s} />
      </div>,
    ];
  }

  if (spec.type === "calc") {
    const lineSize = fit((spec.intro ?? "") + (spec.outro ?? ""), [[60, 48], [100, 42]], 36);
    return [
      <Plane key="p" s={s} />,
      <Spacer key="sp" />,
      <div key="b" style={{ display: "flex", flexDirection: "column" }}>
        {spec.intro ? <div style={{ display: "flex", fontSize: lineSize, fontWeight: 700, color: s.ink, lineHeight: 1.12, letterSpacing: -0.5 }}>{spec.intro}</div> : null}
        <div style={{ display: "flex", marginTop: spec.intro ? 14 : 0, fontSize: fit(spec.number ?? "", [[5, 208], [8, 172], [12, 132]], 108), fontWeight: 900, color: s.ink, lineHeight: 1, letterSpacing: -4 }}>{spec.number}</div>
        {spec.outro ? <div style={{ display: "flex", marginTop: 14, fontSize: lineSize, fontWeight: 700, color: s.ink, lineHeight: 1.12, letterSpacing: -0.5 }}>{spec.outro}</div> : null}
        <Handle s={s} />
      </div>,
    ];
  }

  if (spec.type === "tip") {
    const items = (spec.items ?? []).slice(0, 4);
    return [
      <Plane key="p" s={s} />,
      <div key="t" style={{ display: "flex", marginTop: 36, fontSize: fit(spec.title ?? "", [[24, 74], [40, 62], [60, 52]], 44), fontWeight: 900, color: s.ink, lineHeight: 1.04, letterSpacing: -1.5 }}>{spec.title}</div>,
      <div key="l" style={{ display: "flex", flexDirection: "column", marginTop: 36, gap: 24 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 999, background: s.badgeBg, color: s.badgeInk, fontSize: 28, fontWeight: 800, marginRight: 22 }}>{i + 1}</div>
            <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: s.ink, lineHeight: 1.2, letterSpacing: -0.5, flexGrow: 1 }}>{it}</div>
          </div>
        ))}
      </div>,
      <Spacer key="sp" />,
      <Handle key="h" s={s} />,
    ];
  }

  // brand (also poster / quote / value)
  return [
    <Plane key="p" s={s} />,
    <Spacer key="sp" />,
    <div key="b" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: fit(spec.headline ?? "", [[20, 128], [34, 112], [52, 96], [76, 80], [104, 66]], 56), fontWeight: 900, color: s.ink, lineHeight: 1.03, letterSpacing: -2 }}>{spec.headline}</div>
      <Handle s={s} />
    </div>,
  ];
}

// Render a card spec to PNG bytes at the given square size (default 1080).
export async function renderSocialCard(spec: CardSpec, size = 1080): Promise<Uint8Array> {
  const s = SCHEMES[spec.scheme] ?? SCHEMES.blue;
  const res = new ImageResponse(
    (
      <div style={{ width: size, height: size, background: s.bg, display: "flex", flexDirection: "column", padding: PAD, fontFamily: "Inter" }}>
        {childrenFor(spec, s)}
      </div>
    ),
    { width: size, height: size, fonts: fonts() }
  );
  return new Uint8Array(await res.arrayBuffer());
}
