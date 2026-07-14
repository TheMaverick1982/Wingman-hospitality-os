import { NextResponse, type NextRequest } from "next/server";
import { platformSectionActor } from "@/lib/auth/require-platform";
import { renderSocialCard } from "@/lib/social-cards/render";
import type { CardSpec, CardType, SchemeKey } from "@/lib/social-cards/schemes";
import { SAMPLE_CARDS } from "@/lib/social-cards/samples";

export const dynamic = "force-dynamic";

// Renders a single card to PNG. Used by the preview gallery (and, later, by the
// generator to produce a post's image). Gated to platform social access.
export async function GET(request: NextRequest) {
  if (!(await platformSectionActor("social"))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const p = request.nextUrl.searchParams;
  const sample = p.get("sample");
  let spec: CardSpec;
  if (sample != null && SAMPLE_CARDS[Number(sample)]) {
    spec = SAMPLE_CARDS[Number(sample)];
  } else {
    spec = {
      type: (p.get("type") || "brand") as CardType,
      scheme: (p.get("scheme") || "blue") as SchemeKey,
      headline: p.get("headline") || undefined,
      stat: p.get("stat") || undefined,
      subhead: p.get("subhead") || undefined,
      support: p.get("support") || undefined,
      intro: p.get("intro") || undefined,
      number: p.get("number") || undefined,
      outro: p.get("outro") || undefined,
      title: p.get("title") || undefined,
      items: p.get("items") ? p.get("items")!.split("|") : undefined,
    };
  }

  const png = await renderSocialCard(spec, Number(p.get("size")) || 1080);
  return new NextResponse(Buffer.from(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
