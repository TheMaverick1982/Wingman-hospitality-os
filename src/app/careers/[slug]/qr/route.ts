import { type NextRequest } from "next/server";
import QRCode from "qrcode";

// QR image for a restaurant's public careers page (/careers/<slug>). Returns an
// SVG so it scales cleanly for a printed "we're hiring" sign, window decal, or
// flyer — scan it and land on the page listing every open role by location. The
// QR encodes the same public URL.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, "");
  // Guard the slug to a plausible public-slug shape so this can't be used to
  // render arbitrary text as a QR.
  const safe = /^[a-z0-9-]{1,64}$/i.test(slug) ? slug : "";
  const url = `${site}/careers/${safe}`;

  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 320, errorCorrectionLevel: "M" });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
