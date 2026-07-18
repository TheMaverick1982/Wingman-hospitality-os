import type { Metadata, Viewport } from "next";
import { getGaMeasurementId } from "@/lib/data/platform-settings";
import { getPlatformPricing } from "@/lib/pricing";
import { DelayedThirdParties } from "@/components/analytics/delayed-third-parties";
import { SalesChat } from "@/components/marketing/sales-chat";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinwingman.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Wingman — The Retention Layer for Hospitality",
    template: "%s | Wingman",
  },
  description:
    "Wingman turns every first-time guest into a second, third, and tenth visit with the culture, training, and accountability system hospitality teams actually use, every shift.",
  keywords: [
    "restaurant guest retention software",
    "hospitality culture and training platform",
    "guest bounce back program",
    "restaurant accountability software",
    "service recovery tracking",
    "restaurant employee training system",
    "multi-location restaurant management",
  ],
  openGraph: {
    type: "website",
    siteName: "Wingman",
    locale: "en_US",
    title: "Wingman — The Retention Layer for Hospitality",
    description:
      "Turn every first-time guest into a second, third, and tenth visit with the culture, training, and accountability system hospitality teams actually use.",
    url: siteUrl,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Wingman — The Retention Layer for Hospitality" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wingman — The Retention Layer for Hospitality",
    description:
      "Turn every first-time guest into a second, third, and tenth visit with the culture, training, and accountability system hospitality teams actually use.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
  },
  // Standalone (installed / native-shell) presentation on iOS.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wingman",
  },
};

// Mobile viewport + theme color. viewportFit "cover" lets the app draw into the
// notch / home-indicator safe areas when running full-screen (native shell).
export const viewport: Viewport = {
  themeColor: "#0a6cff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Two linked nodes in one @graph: the Organization (brand entity → knowledge
// panel / brand SERP) and the SoftwareApplication (the product + its offer). The
// offer price reads the live platform pricing so it never goes stale.
function buildStructuredData(firstLocationPrice: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Wingman",
        legalName: "Wingman by The Maverick Agency",
        url: siteUrl,
        logo: `${siteUrl}/og-image.png`,
        description:
          "Wingman is the retention layer for hospitality — the culture, training, and accountability system that turns first-time restaurant guests into regulars.",
        sameAs: ["https://www.instagram.com/joinwingmanapp/", "https://www.facebook.com/joinwingmanapp"],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: "Wingman",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: siteUrl,
        publisher: { "@id": `${siteUrl}/#organization` },
        description:
          "Wingman turns every first-time restaurant guest into a second, third, and tenth visit with the culture, training, and accountability system hospitality teams actually use, every shift.",
        offers: {
          "@type": "Offer",
          price: firstLocationPrice,
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: firstLocationPrice,
            priceCurrency: "USD",
            unitText: "per month, first location",
          },
        },
      },
    ],
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = await getGaMeasurementId();
  const { firstCents } = await getPlatformPricing();
  const structuredData = buildStructuredData(String(Math.round(firstCents / 100)));

  return (
    <html lang="en" className="h-full antialiased">
      <body className="force-light min-h-full flex flex-col bg-paper text-ink font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <main className="flex-1 flex flex-col min-h-0">{children}</main>
        <SalesChat />
      </body>
      <DelayedThirdParties gtmId="GTM-P7CJ3J7G" gaId={gaMeasurementId} />
    </html>
  );
}
