"use client";

import { useState } from "react";
import { Copy, Check, QrCode, Star, MessageSquare } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { avgRating, RATING_LABEL } from "@/lib/guest-survey";

export type SurveyLinkRow = { locationId: string; locationName: string; code: string; scanCount: number };
export type ReviewRow = {
  id: string;
  locationName: string;
  serverFirstName: string;
  ratings: Record<string, number>;
  comment: string;
  createdAt: string;
};

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Stars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= rounded ? "text-gold fill-gold" : "text-line"} strokeWidth={2} />
      ))}
    </span>
  );
}

export function ReviewsClient({ siteUrl, links, responses }: { siteUrl: string; links: SurveyLinkRow[]; responses: ReviewRow[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const shortLink = (code: string) => `${siteUrl}/s/${code}`;
  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  }

  const rated = responses.filter((r) => avgRating(r.ratings) > 0);
  const overallAvg = rated.length ? rated.reduce((a, r) => a + avgRating(r.ratings), 0) / rated.length : 0;
  const positives = rated.filter((r) => avgRating(r.ratings) >= 4.5).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Guest Reviews</h1>
        <p className="text-base text-muted max-w-xl">
          Feedback guests leave from your survey QR / link. It lives here, separate from Guest Bounce Back — a response
          never adds a guest or counts as a visit.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="text-[12px] text-muted-2 font-medium">Responses</div>
          <div className="text-[26px] font-bold text-ink tabular-nums">{responses.length}</div>
        </div>
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="text-[12px] text-muted-2 font-medium">Avg rating</div>
          <div className="text-[26px] font-bold text-ink tabular-nums flex items-center gap-2">
            {overallAvg ? overallAvg.toFixed(1) : "—"} {overallAvg > 0 && <Stars value={overallAvg} />}
          </div>
        </div>
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="text-[12px] text-muted-2 font-medium">Rave reviews</div>
          <div className="text-[26px] font-bold text-olive tabular-nums">{positives}</div>
        </div>
      </div>

      {/* Share links */}
      <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
        <div className="text-[16px] font-semibold tracking-[-0.01em] text-ink mb-1">Share your survey</div>
        <p className="text-[13px] text-muted mb-4">
          Put the QR on a table tent, receipt, or window — or drop the link in a text/email. Each location has its own.
        </p>
        <div className="flex flex-col gap-2.5">
          {links.map((l) => (
            <div key={l.locationId} className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-line p-3.5">
              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold text-ink">{l.locationName}</div>
                <div className="text-[12.5px] text-muted-2 font-mono break-all">{shortLink(l.code)}</div>
                <div className="text-[12px] text-muted-2 tabular-nums mt-0.5">{l.scanCount} scan{l.scanCount === 1 ? "" : "s"}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => copy(shortLink(l.code), `l:${l.code}`)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-charcoal-2 border border-line rounded-full px-2.5 py-1 hover:border-brick hover:text-brick">
                  {copied === `l:${l.code}` ? <Check size={12} /> : <Copy size={12} />} {copied === `l:${l.code}` ? "Copied" : "Link"}
                </button>
                <button type="button" aria-label="QR code" onClick={() => setQr(l.code)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-charcoal-2 border border-line rounded-full px-2.5 py-1 hover:border-brick hover:text-brick">
                  <QrCode size={12} /> QR
                </button>
              </div>
            </div>
          ))}
          {links.length === 0 && <p className="text-sm text-muted py-2">No locations yet.</p>}
        </div>
      </div>

      {/* Archive */}
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-2 mb-3">Recent feedback</div>
        {responses.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-8 text-center">
            <MessageSquare className="mx-auto text-muted-2 mb-2" size={24} />
            <p className="text-[15px] text-muted">No responses yet. Share your survey QR / link and they&rsquo;ll show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {responses.map((r) => {
              const avg = avgRating(r.ratings);
              return (
                <div key={r.id} className="bg-white border border-line rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {avg > 0 && <Stars value={avg} />}
                      {r.locationName && <span className="text-[12.5px] text-muted-2">{r.locationName}</span>}
                      {r.serverFirstName && (
                        <span className="text-[11.5px] font-semibold text-olive bg-olive-tint rounded-full px-2 py-0.5">Served by {r.serverFirstName}</span>
                      )}
                    </div>
                    <span className="text-[12px] text-muted-2">{when(r.createdAt)}</span>
                  </div>
                  {Object.keys(r.ratings).length > 0 && (
                    <div className="text-[12px] text-muted-2 mt-1.5 flex flex-wrap gap-x-3">
                      {Object.entries(r.ratings).map(([k, v]) => (
                        <span key={k}>{(RATING_LABEL[k] ?? k).replace(/\?$/, "")}: <span className="font-semibold text-ink">{v}/5</span></span>
                      ))}
                    </div>
                  )}
                  {r.comment && <p className="text-[14px] text-ink leading-relaxed mt-2 whitespace-pre-wrap">{r.comment}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {qr && (
        <Modal title="Survey QR code" sub="Scan to open the guest survey — print it on a table tent, receipt, or window cling." onClose={() => setQr(null)}>
          <div className="flex flex-col items-center gap-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/s/${qr}/qr`} alt="Survey QR code" width={240} height={240} className="rounded-xl border border-line" />
            <div className="text-[12px] text-muted-2 font-mono break-all text-center">{shortLink(qr)}</div>
            <a href={`/s/${qr}/qr`} download={`survey-${qr}.svg`} className="text-[13px] font-semibold text-brick hover:opacity-70">
              Download QR (SVG)
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
