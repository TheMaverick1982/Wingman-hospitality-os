import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCalendarSettingsBySlug } from "@/lib/calendar/settings";
import { WingmanMark } from "@/components/ui/wingman-mark";
import { BookingWidget } from "@/components/booking/booking-widget";

export const metadata: Metadata = {
  title: "Book a meeting",
  robots: { index: false, follow: false },
};

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const settings = await getCalendarSettingsBySlug(slug);
  if (!settings || !settings.is_active) notFound();

  const admin = createAdminClient();
  const { data: host } = await admin.from("profiles").select("full_name").eq("id", settings.user_id).maybeSingle();
  const hostName = (host as { full_name?: string } | null)?.full_name || "our team";
  const title = settings.page_title || `Book a meeting with ${hostName}`;

  return (
    <div className="flex-1 flex flex-col force-light bg-paper min-h-full">
      <div className="max-w-[880px] w-full mx-auto px-5 sm:px-8 py-10 sm:py-16">
        <div className="flex items-center gap-2 mb-8">
          <WingmanMark className="h-7 w-auto" />
          <span className="font-display text-lg font-semibold text-ink">Wingman</span>
        </div>

        <div className="bg-panel border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr]">
            <div className="p-7 border-b md:border-b-0 md:border-r border-line bg-white">
              <p className="text-[13px] font-semibold text-brick uppercase tracking-[0.06em] mb-2">{hostName}</p>
              <h1 className="font-display text-2xl font-semibold text-ink leading-tight mb-3">{title}</h1>
              {settings.page_description && (
                <p className="text-sm text-muted leading-relaxed">{settings.page_description}</p>
              )}
            </div>
            <div className="p-7">
              <BookingWidget
                slotsUrl={`/api/book/${encodeURIComponent(settings.slug)}/slots`}
                bookUrl={`/api/book/${encodeURIComponent(settings.slug)}`}
                hostName={hostName}
                durationMinutes={settings.meeting_duration_minutes}
              />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-6">Powered by Wingman</p>
      </div>
    </div>
  );
}
