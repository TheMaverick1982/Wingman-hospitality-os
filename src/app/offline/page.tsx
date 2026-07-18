import type { Metadata } from "next";
import { WingmanLogo } from "@/components/ui/wingman-logo";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

// Shown by the service worker when a navigation fails with no network. Fully
// static and auth-free so it can be precached and served to anyone.
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center force-light">
      <WingmanLogo className="h-7 w-auto mb-6" />
      <h1 className="font-display text-2xl font-bold text-ink mb-2">You&apos;re offline</h1>
      <p className="text-muted max-w-[340px] leading-[1.55]">
        Wingman can&apos;t reach the internet right now. Check your connection and try again — the app will pick right back up.
      </p>
    </div>
  );
}
