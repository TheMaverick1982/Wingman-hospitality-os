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
  },
  twitter: {
    card: "summary_large_image",
    title: "Wingman — The Retention Layer for Hospitality",
    description:
      "Turn every first-time guest into a second, third, and tenth visit with the culture, training, and accountability system hospitality teams actually use.",
  },
  robots: {
    index: true,
    follow: true,
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
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">{children}</body>
      {gaMeasurementId && <GoogleAnalytics gaId={gaMeasurementId} />}
    </html>
  );
}
