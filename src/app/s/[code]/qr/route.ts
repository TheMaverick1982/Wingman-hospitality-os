import { type NextRequest } from "next/server";
import QRCode from "qrcode";

// QR image for a location's guest-survey short link (/s/<code>). Returns an SVG
// so it scales cleanly for a printed table tent, receipt stamp, or window cling —
// scan it and land on the survey. Encodes the same short URL.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, "");
  const safe = /^[a-z0-9]{4,16}$/i.test(code) ? code : "";
  const url = `${site}/s/${safe}`;

  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 320, errorCorrectionLevel: "M" });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
