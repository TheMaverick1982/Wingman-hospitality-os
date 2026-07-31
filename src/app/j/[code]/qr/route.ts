import { type NextRequest } from "next/server";
import QRCode from "qrcode";

// QR image for a job opening's short link (/j/<code>). Returns an SVG so it
// scales cleanly for a printed "we're hiring" sign, table tent, or flyer — scan
// it and land on the pre-filled apply form. The QR encodes the same short URL.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, "");
  // Guard the code to a plausible short-code shape so this can't be used to
  // render arbitrary text as a QR.
  const safe = /^[a-z0-9]{4,16}$/i.test(code) ? code : "";
  const url = `${site}/j/${safe}`;

  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 320, errorCorrectionLevel: "M" });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
