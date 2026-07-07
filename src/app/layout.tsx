import type { Metadata } from "next";
import { GoogleTagManager, GoogleAnalytics } from "@next/third-parties/google";
import { getGaMeasurementId } from "@/lib/data/platform-settings";
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
  robots: {
    index: true,
    follow: true,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Wingman",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description:
    "Wingman turns every first-time restaurant guest into a second, third, and tenth visit with the culture, training, and accountability system hospitality teams actually use, every shift.",
  offers: {
    "@type": "Offer",
    price: "199",
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "199",
      priceCurrency: "USD",
      unitText: "per location, per month",
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = await getGaMeasurementId();

  return (
    <html lang="en" className="h-full antialiased">
      <GoogleTagManager gtmId="GTM-P7CJ3J7G" />
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <main className="flex-1 flex flex-col min-h-0">{children}</main>
      </body>
      {gaMeasurementId && <GoogleAnalytics gaId={gaMeasurementId} />}
    </html>
  );
}
