// Minimal RFC 5545 .ics builder for booking confirmations. We emit UTC stamps
// (DTSTART/DTEND with a Z suffix) so no VTIMEZONE block is needed — every client
// renders them in the recipient's local zone correctly.

function icsStamp(atMs: number): string {
  // YYYYMMDDTHHMMSSZ
  return new Date(atMs).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Fold lines to <=75 octets per RFC 5545 (continuations start with a space).
function fold(line: string): string {
  if (line.length <= 74) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length) {
    chunks.push(" " + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  return chunks.join("\r\n");
}

export function buildIcs(opts: {
  uid: string;
  startMs: number;
  endMs: number;
  summary: string;
  description: string;
  location: string; // usually the Meet link
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
  createdMs: number;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wingman//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${icsStamp(opts.createdMs)}`,
    `DTSTART:${icsStamp(opts.startMs)}`,
    `DTEND:${icsStamp(opts.endMs)}`,
    `SUMMARY:${escapeText(opts.summary)}`,
    `DESCRIPTION:${escapeText(opts.description)}`,
    `LOCATION:${escapeText(opts.location)}`,
    `ORGANIZER;CN=${escapeText(opts.organizerName)}:mailto:${opts.organizerEmail}`,
    `ATTENDEE;CN=${escapeText(opts.attendeeName)};RSVP=TRUE:mailto:${opts.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
