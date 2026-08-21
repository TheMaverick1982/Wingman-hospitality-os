"use client";

import { useState, useTransition } from "react";
import { Sparkles, Plus, Copy, Check, X, Pencil, Trash2, QrCode } from "lucide-react";
import { Btn } from "@/components/ui/btn";
import { Modal } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/field";
import { generateOpeningAd, saveOpening, setOpeningStatus, deleteOpening } from "./openings-actions";

export type OpeningRow = {
  id: string;
  department: string;
  location_id: string | null;
  title: string | null;
  ad_copy: string;
  pay_note: string | null;
  employment_type: string | null;
  status: string;
  created_at: string;
  code: string | null;
  click_count: number | null;
};

type LocOpt = { id: string; name: string };

const ALL_LOCATIONS = "__all__";

export function OpeningsPanel({
  openings,
  counts,
  locations,
  departments,
  applyUrl,
  careersUrl,
  siteUrl,
  canEdit,
}: {
  openings: OpeningRow[];
  counts: Record<string, number>;
  locations: LocOpt[];
  departments: string[];
  applyUrl: string | null;
  careersUrl: string | null;
  siteUrl: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<OpeningRow | "new" | null>(null);
  const [busyId, startBusy] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const locName = (id: string | null) => (id ? locations.find((l) => l.id === id)?.name ?? "A location" : "All locations");
  // Prefer the short branded link (/j/<code>); fall back to the full apply URL for
  // any opening that doesn't have a code yet.
  const shortLink = (o: OpeningRow) => (o.code ? `${siteUrl}/j/${o.code}` : applyUrl ? `${applyUrl}?opening=${o.id}` : "");

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard may be blocked; no-op */
    }
  }

  const open = openings.filter((o) => o.status === "open");
  const closed = openings.filter((o) => o.status !== "open");

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-[13px] text-muted">Counts below are applicants who came through each posting; your full applicant list (including direct applications) is further down.</p>
        {canEdit && (
          <Btn small icon={Plus} onClick={() => setEditing("new")}>
            Create opening
          </Btn>
        )}
      </div>

      {careersUrl && open.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-brick-tint/40 border border-brick/20 rounded-xl px-4 py-3 mb-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink">Your public careers page</div>
            <div className="text-[12.5px] text-muted-2 font-mono truncate">{careersUrl.replace(/^https?:\/\//, "")}</div>
            <div className="text-[12px] text-muted mt-0.5">One link with every open role, by location — put it on your website, Google profile, and social.</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={careersUrl} target="_blank" rel="noopener" className="text-[12.5px] font-semibold text-brick hover:text-brick-dark">Open</a>
            <button
              onClick={() => copy(careersUrl, "careers")}
              className="text-[12.5px] font-semibold text-white bg-brick rounded-full px-3.5 py-1.5 hover:bg-brick-dark transition-colors"
            >
              {copiedId === "careers" ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}

      {openings.length === 0 ? (
        <p className="text-sm text-muted py-2">No openings yet. Create one to get a ready-to-post ad and an apply link that comes straight to this role.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {[...open, ...closed].map((o) => {
            const isClosed = o.status !== "open";
            const count = counts[o.id] ?? 0;
            const clicks = o.click_count ?? 0;
            return (
              <div key={o.id} className={`rounded-xl border p-3.5 ${isClosed ? "border-line bg-paper/40 opacity-75" : "border-line"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14.5px] font-semibold text-ink">{o.title?.trim() || o.department}</span>
                      <span className="text-[12px] text-muted-2">· {locName(o.location_id)}</span>
                      {isClosed && <span className="text-[11px] font-semibold text-muted-2 bg-paper border border-line rounded-full px-2 py-0.5">Closed</span>}
                      {!isClosed && <span className="text-[11px] font-semibold text-olive bg-olive-tint rounded-full px-2 py-0.5">Open</span>}
                    </div>
                    <div className="text-[12px] text-muted-2 mt-0.5">
                      {o.department}
                      {o.pay_note ? ` · ${o.pay_note}` : ""}
                      {o.employment_type ? ` · ${o.employment_type}` : ""}
                    </div>
                    {(clicks > 0 || count > 0) && (
                      <div className="text-[12px] text-muted-2 mt-0.5 tabular-nums">
                        {clicks} click{clicks === 1 ? "" : "s"} · {count} applicant{count === 1 ? "" : "s"} via this posting
                        {/* Only a valid conversion when applicants came through the tracked link — applicants can also arrive via the QR or a copied apply link, so count can exceed clicks. Show the rate only when it's ≤100%. */}
                        {clicks > 0 && count <= clicks ? ` · ${Math.round((count / clicks) * 100)}% applied` : ""}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isClosed && shortLink(o) && (
                        <button type="button" onClick={() => copy(shortLink(o), `link:${o.id}`)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-charcoal-2 border border-line rounded-full px-2.5 py-1 hover:border-brick hover:text-brick">
                          {copiedId === `link:${o.id}` ? <Check size={12} /> : <Copy size={12} />} {copiedId === `link:${o.id}` ? "Copied" : "Apply link"}
                        </button>
                      )}
                      {!isClosed && o.code && (
                        <button type="button" aria-label="QR code" onClick={() => setQrCode(o.code)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-charcoal-2 border border-line rounded-full px-2.5 py-1 hover:border-brick hover:text-brick">
                          <QrCode size={12} /> QR
                        </button>
                      )}
                      {o.ad_copy && (
                        <button type="button" onClick={() => copy(o.ad_copy, `ad:${o.id}`)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-charcoal-2 border border-line rounded-full px-2.5 py-1 hover:border-brick hover:text-brick">
                          {copiedId === `ad:${o.id}` ? <Check size={12} /> : <Copy size={12} />} {copiedId === `ad:${o.id}` ? "Copied" : "Ad copy"}
                        </button>
                      )}
                      <button type="button" aria-label="Edit" onClick={() => setEditing(o)} className="text-muted-2 hover:text-ink p-1"><Pencil size={14} /></button>
                      <button
                        type="button"
                        onClick={() => startBusy(async () => { await setOpeningStatus(o.id, isClosed ? "open" : "closed"); })}
                        disabled={busyId}
                        title={isClosed ? "Reopen — show this role on your careers page again" : "Close — hide this role from your careers page (applicants are kept)"}
                        className={`inline-flex items-center gap-1 text-[12px] font-semibold rounded-full px-2.5 py-1 transition-colors disabled:opacity-50 ${
                          isClosed
                            ? "text-white bg-olive hover:opacity-90"
                            : "text-charcoal-2 border border-line hover:border-brick hover:text-brick"
                        }`}
                      >
                        {isClosed ? "Reopen" : "Close"}
                      </button>
                      <button
                        type="button"
                        aria-label="Delete"
                        onClick={() => { if (confirm("Delete this opening? Applicants who already applied are kept.")) startBusy(async () => { await deleteOpening(o.id); }); }}
                        disabled={busyId}
                        className="text-muted-2 hover:text-danger p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <OpeningEditor
          opening={editing === "new" ? null : editing}
          locations={locations}
          departments={departments}
          applyUrl={applyUrl}
          siteUrl={siteUrl}
          onClose={() => setEditing(null)}
        />
      )}

      {qrCode && (
        <Modal title="QR code" sub="Scan to open the pre-filled apply form — great for a window sign, table tent, or flyer." onClose={() => setQrCode(null)}>
          <div className="flex flex-col items-center gap-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/j/${qrCode}/qr`} alt="Opening QR code" width={240} height={240} className="rounded-xl border border-line" />
            <div className="text-[12px] text-muted-2 font-mono break-all text-center">{siteUrl}/j/{qrCode}</div>
            <a href={`/j/${qrCode}/qr`} download={`opening-${qrCode}.svg`} className="text-[13px] font-semibold text-brick hover:opacity-70">
              Download QR (SVG)
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}

function OpeningEditor({
  opening,
  locations,
  departments,
  applyUrl,
  siteUrl,
  onClose,
}: {
  opening: OpeningRow | null;
  locations: LocOpt[];
  departments: string[];
  applyUrl: string | null;
  siteUrl: string;
  onClose: () => void;
}) {
  const [department, setDepartment] = useState(opening?.department ?? departments[0] ?? "");
  const [locationId, setLocationId] = useState<string>(opening?.location_id ?? ALL_LOCATIONS);
  const [payNote, setPayNote] = useState(opening?.pay_note ?? "");
  const [employmentType, setEmploymentType] = useState(opening?.employment_type ?? "");
  const [mustHaves, setMustHaves] = useState("");
  const [existing, setExisting] = useState("");
  const [adCopy, setAdCopy] = useState(opening?.ad_copy ?? "");
  const [genPending, startGen] = useTransition();
  const [savePending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(opening?.id ?? null);
  const [savedCode, setSavedCode] = useState<string | null>(opening?.code ?? null);
  const [copied, setCopied] = useState(false);

  // Prefer the short branded link; fall back to the full apply URL until a code exists.
  const link = savedCode ? `${siteUrl}/j/${savedCode}` : savedId && applyUrl ? `${applyUrl}?opening=${savedId}` : "";

  function generate() {
    setError(null);
    startGen(async () => {
      const res = await generateOpeningAd({
        department,
        locationId: locationId === ALL_LOCATIONS ? null : locationId,
        payNote: payNote || undefined,
        employmentType: employmentType || undefined,
        mustHaves: mustHaves || undefined,
        existing: existing || undefined,
      });
      if (res.error) setError(res.error);
      else if (res.adCopy) setAdCopy(res.adCopy);
    });
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await saveOpening({
        id: opening?.id ?? null,
        department,
        locationId: locationId === ALL_LOCATIONS ? null : locationId,
        payNote,
        employmentType,
        adCopy,
      });
      if (res.error) setError(res.error);
      else {
        setSavedId(res.id ?? opening?.id ?? null);
        if (res.code) setSavedCode(res.code);
      }
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  }

  return (
    <Modal title={opening ? "Edit opening" : "Create an opening"} sub="Pick the role and location, let Wingman draft the ad, then post it with your apply link." onClose={onClose} wide>
      <div className="flex flex-col gap-4 max-h-[64vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[13px] font-semibold text-ink mb-1 block">Role</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-semibold text-ink mb-1 block">Location</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputClass}>
              <option value={ALL_LOCATIONS}>All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-semibold text-ink mb-1 block">Pay <span className="font-normal text-muted-2">(optional)</span></label>
            <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="e.g. $18–22/hr + tips" className={inputClass} />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-ink mb-1 block">Type <span className="font-normal text-muted-2">(optional)</span></label>
            <input value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} placeholder="e.g. Full-time, Part-time" className={inputClass} />
          </div>
        </div>

        <div>
          <label className="text-[13px] font-semibold text-ink mb-1 block">Anything specific to include? <span className="font-normal text-muted-2">(optional)</span></label>
          <textarea value={mustHaves} onChange={(e) => setMustHaves(e.target.value)} rows={2} placeholder="Must-haves, shifts, vibe, perks — e.g. 'weekend availability required, wine knowledge a plus'" className={`${inputClass} resize-y`} />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-ink mb-1 block">Have an existing ad? Paste it to improve <span className="font-normal text-muted-2">(optional)</span></label>
          <textarea value={existing} onChange={(e) => setExisting(e.target.value)} rows={2} placeholder="Paste your current job post and Wingman will sharpen it." className={`${inputClass} resize-y`} />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="text-[13px] font-semibold text-ink">Job ad</label>
            <button type="button" onClick={generate} disabled={genPending} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brick border border-brick/40 rounded-full px-3 py-1.5 hover:bg-brick-tint disabled:opacity-50">
              <Sparkles size={13} /> {genPending ? "Writing…" : adCopy.trim() ? "Rewrite with AI" : "Generate ad with AI"}
            </button>
          </div>
          <textarea value={adCopy} onChange={(e) => setAdCopy(e.target.value)} rows={10} placeholder="Your job ad will appear here — tap Generate with AI, then edit freely." className={`${inputClass} resize-y text-[13.5px] leading-[1.55]`} />
        </div>

        {savedId && link && (
          <div className="rounded-xl border border-olive/30 bg-olive-tint/40 p-3">
            <div className="text-[12.5px] font-semibold text-[#4d7c0f] mb-1.5 flex items-center gap-1"><Check size={13} /> Saved. Share this apply link:</div>
            <div className="flex items-center gap-2">
              <input readOnly value={link} className={`${inputClass} text-[12.5px] font-mono`} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={copyLink} className="shrink-0 inline-flex items-center gap-1 text-[12.5px] font-semibold text-white bg-brick rounded-full px-3 py-2 hover:bg-brick-dark">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-[11.5px] text-muted-2 mt-1.5">Paste the ad on Indeed/Craigslist and use this link as the &ldquo;apply&rdquo; URL — applicants land pre-set to this role &amp; location, and show up tagged to this opening.</p>
            {savedCode && (
              <a href={`/j/${savedCode}/qr`} download={`opening-${savedCode}.svg`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brick hover:opacity-70 mt-2">
                <QrCode size={12} /> Download QR code
              </a>
            )}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="flex justify-between items-center gap-2 mt-4">
        <Btn type="button" kind="ghost" icon={X} onClick={onClose}>Close</Btn>
        <Btn type="button" onClick={save} loading={savePending} disabled={!department}>
          {savePending ? "Saving…" : savedId ? "Save changes" : "Save opening"}
        </Btn>
      </div>
    </Modal>
  );
}
