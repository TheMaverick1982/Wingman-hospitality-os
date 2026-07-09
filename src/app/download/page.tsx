import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { DownloadClient } from "@/components/download/download-client";

export const metadata: Metadata = {
  title: "Get the App",
  description:
    "Install Wingman on your phone — your hospitality culture, training, checklists, and guest bounce-back system, on every shift.",
  alternates: { canonical: "/download" },
  openGraph: {
    title: "Get the Wingman App",
    description: "Install Wingman on your phone — culture, training, and accountability on every shift.",
    url: "/download",
  },
};

export default function DownloadPage() {
  return (
    <div className="flex-1 flex flex-col force-light bg-panel">
      <MarketingNav />
      <div className="flex-1 flex items-center justify-center px-6 py-16 sm:py-24">
        <DownloadClient />
      </div>
      <MarketingFooter />
    </div>
  );
}
