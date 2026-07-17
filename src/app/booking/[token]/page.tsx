import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookingByToken } from "@/lib/calendar/book";
import { formatDateLong, formatTime } from "@/lib/calendar/availability";
import { WingmanMark } from "@/components/ui/wingman-mark";
import { ManageClient } from "./manage-client";

export const metadata: Metadata = {
  title: "Manage your booking",
  robots: { index: false, follow: false },
};

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();

  const dateLabel = formatDateLong(booking.startMs, booking.timeZone);
  const timeLabel = `${formatTime(booking.startMs, booking.timeZone)} – ${formatTime(booking.endMs, booking.timeZone)}`;

  return (
    <div className="flex-1 flex flex-col force-light bg-paper min-h-full">
      <div className="max-w-[560px] w-full mx-auto px-5 sm:px-8 py-10 sm:py-16">
        <div className="flex items-center gap-2 mb-8">
          <WingmanMark className="h-7 w-auto" />
          <span className="font-display text-lg font-semibold text-ink">Wingman</span>
        </div>

        <div className="bg-panel border border-line rounded-2xl shadow-sm p-7">
          <ManageClient
            token={token}
            hostName={booking.hostName}
            dateLabel={dateLabel}
            timeLabel={timeLabel}
            timeZone={booking.timeZone}
            meetLink={booking.meetLink}
            status={booking.status}
            rebookPath={booking.rebookPath}
          />
        </div>

        <p className="text-center text-xs text-muted mt-6">Powered by Wingman</p>
      </div>
    </div>
  );
}
