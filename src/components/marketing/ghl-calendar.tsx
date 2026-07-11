"use client";

import Script from "next/script";

// GoHighLevel booking widget. GHL embeds as an iframe plus form_embed.js, which
// auto-resizes the iframe to the booking flow's height. The booking URL is on
// the white-labeled links.themaverick.ai domain; the resize script is GHL's
// standard host and works regardless of the calendar's domain.
const CALENDAR_ID = "shgJKPpzfjurOVzepcDk";
const BOOKING_URL = `https://links.themaverick.ai/widget/booking/${CALENDAR_ID}`;

export function GhlCalendar() {
  return (
    <>
      <iframe
        src={BOOKING_URL}
        title="Book a Wingman demo"
        style={{ width: "100%", border: "none", overflow: "hidden", minHeight: 720 }}
        scrolling="no"
        id={`${CALENDAR_ID}_booking`}
      />
      <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="afterInteractive" />
    </>
  );
}
