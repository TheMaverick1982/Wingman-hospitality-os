"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Mail, CalendarPlus, Pencil, Phone, Globe, MapPin, Check, Clock, StickyNote,
  PhoneCall, CalendarCheck, DollarSign, Send, Plus,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Btn } from "@/components/ui/btn";
import { inputClass } from "@/components/ui/field";
import { ACTIVITY_LABELS, money, fmtDate, type PartnerActivityType, type PartnerContact } from "@/lib/partners";
import { addContactNote, scheduleReachOut, completeReachOut, sendContactEmail } from "./actions";

export type DetailActivity = {
  id: string;
  contact_id: string;
  activity_date: string;
  activity_type: PartnerActivityType;
  notes: string;
  revenue_cents: number | null;
  loggedBy: string;
};
export type DetailFollowUp = { id: string; contact_id: string; due_date: string; notes: string; createdBy: string };

function ActivityIcon({ type, hasRevenue }: { type: PartnerActivityType; hasRevenue: boolean }) {
  if (type === "call_text") return <PhoneCall size={14} />;
  if (type === "email") return <Mail size={14} />;
  if (type === "note") return <StickyNote size={14} />;
  if (type === "event_booked" || type === "fundraiser_booked") return <CalendarCheck size={14} />;
  if (hasRevenue) return <DollarSign size={14} />;
  return <Clock size={14} />;
}

export function ContactDetail({
  contact,
  activities,
  followUps,
  repEmail,
  canEdit,
  onEdit,
  onClose,
  locationName,
}: {
  contact: PartnerContact;
  activities: DetailActivity[];
  followUps: DetailFollowUp[];
  repEmail: string;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
  locationName: string | null;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [noteText, setNoteText] = useState("");

  const [reachOpen, setReachOpen] = useState(false);
  const [reachDate, setReachDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [reachNote, setReachNote] = useState("");

  const [emailOpen, setEmailOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  }

  function addNote() {
    if (!noteText.trim()) return;
    start(async () => {
      const res = await addContactNote(contact.id, noteText);
      if (res.error) flash(res.error, false);
      else { setNoteText(""); flash("Note added", true); }
    });
  }
  function schedule() {
    start(async () => {
      const res = await scheduleReachOut(contact.id, reachDate, reachNote);
      if (res.error) flash(res.error, false);
      else { setReachOpen(false); setReachNote(""); flash("Reach-out scheduled", true); }
    });
  }
  function markDone(id: string) {
    start(async () => {
      const res = await completeReachOut(id);
      if (res.error) flash(res.error, false);
    });
  }
  function send() {
    start(async () => {
      const res = await sendContactEmail(contact.id, subject, emailBody);
      if (res.error) flash(res.error, false);
      else { setEmailOpen(false); setSubject(""); setEmailBody(""); flash("Email sent", true); }
    });
  }

  const openReachOuts = followUps.filter((f) => f.contact_id === contact.id);
  const contactActivities = activities.filter((a) => a.contact_id === contact.id);
  const label = "text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-2";

  return (
    <Modal title={contact.company_name} sub={[contact.contact_name, contact.title].filter(Boolean).join(" · ") || undefined} onClose={onClose} wide>
      {/* Quick actions */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Btn small icon={Mail} onClick={() => { setEmailOpen((v) => !v); setReachOpen(false); }} disabled={!contact.email}>
            Email
          </Btn>
          <Btn small kind="ghost" icon={CalendarPlus} onClick={() => { setReachOpen((v) => !v); setEmailOpen(false); }}>
            Schedule reach-out
          </Btn>
          <Btn small kind="ghost" icon={Pencil} onClick={onEdit}>Edit</Btn>
          {msg && <span className={`text-[12.5px] font-semibold ${msg.ok ? "text-olive" : "text-danger"}`}>{msg.text}</span>}
        </div>
      )}

      {/* Contact info */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted-2 mb-4">
        {contact.category && <span>{contact.category}{contact.subcategory ? ` · ${contact.subcategory}` : ""}</span>}
        {locationName && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {locationName}</span>}
        {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-charcoal-2 hover:text-brick"><Mail size={13} /> {contact.email}</a>}
        {contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 text-charcoal-2 hover:text-brick"><Phone size={13} /> {contact.phone}</a>}
        {contact.website && <a href={contact.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-charcoal-2 hover:text-brick"><Globe size={13} /> Website</a>}
      </div>

      {contact.notes && (
        <div className="rounded-xl bg-paper border border-line p-3 mb-4">
          <div className={`${label} mb-1`}>About</div>
          <p className="text-[13px] text-charcoal-2 whitespace-pre-wrap">{contact.notes}</p>
        </div>
      )}

      {/* Email composer */}
      {emailOpen && canEdit && (
        <div className="rounded-xl border border-line p-4 mb-4">
          <div className="text-[13px] font-semibold text-ink mb-2">Email {contact.contact_name || contact.company_name}</div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={`${inputClass} mb-2`} />
          <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={5} placeholder="Write your message…" className={inputClass} />
          <div className="flex items-center gap-2 mt-2">
            <Btn small icon={Send} onClick={send} disabled={pending || !subject.trim() || !emailBody.trim()}>{pending ? "Sending…" : "Send email"}</Btn>
            <Btn small kind="ghost" onClick={() => setEmailOpen(false)}>Cancel</Btn>
            <span className="text-[11.5px] text-muted-2">{repEmail ? `Replies go to ${repEmail}` : "Sent from your name"}</span>
          </div>
        </div>
      )}

      {/* Reach-out scheduler */}
      {reachOpen && canEdit && (
        <div className="rounded-xl border border-line p-4 mb-4">
          <div className="text-[13px] font-semibold text-ink mb-2">Schedule a reach-out</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="date" value={reachDate} onChange={(e) => setReachDate(e.target.value)} className={`${inputClass} sm:w-44`} />
            <input value={reachNote} onChange={(e) => setReachNote(e.target.value)} placeholder="What's the next step?" className={inputClass} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Btn small icon={Plus} onClick={schedule} disabled={pending || !reachDate}>{pending ? "Saving…" : "Schedule"}</Btn>
            <Btn small kind="ghost" onClick={() => setReachOpen(false)}>Cancel</Btn>
            <span className="text-[11.5px] text-muted-2">We&rsquo;ll email you when it&rsquo;s due.</span>
          </div>
        </div>
      )}

      {/* Open reach-outs */}
      {openReachOuts.length > 0 && (
        <div className="mb-4">
          <div className={`${label} mb-1.5`}>Upcoming reach-outs</div>
          <div className="flex flex-col gap-1.5">
            {openReachOuts.map((f) => {
              const overdue = f.due_date < today;
              return (
                <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                  <div className="min-w-0 text-[13px]">
                    <span className={overdue ? "text-danger font-semibold" : "text-charcoal-2 font-medium"}>
                      {overdue ? "Overdue · " : "Due "}{fmtDate(f.due_date)}
                    </span>
                    {f.notes && <span className="text-muted"> — {f.notes}</span>}
                  </div>
                  {canEdit && (
                    <button onClick={() => markDone(f.id)} disabled={pending} className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-2 hover:text-olive shrink-0">
                      <Check size={13} /> Done
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add a note */}
      {canEdit && (
        <div className="mb-4">
          <div className={`${label} mb-1.5`}>Add a note</div>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} placeholder="Log a detail, a next step, what was discussed…" className={inputClass} />
          <div className="mt-1.5">
            <Btn small kind="ghost" icon={StickyNote} onClick={addNote} disabled={pending || !noteText.trim()}>Add note</Btn>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <div className={`${label} mb-1.5`}>Activity</div>
        {contactActivities.length === 0 ? (
          <p className="text-[13px] text-muted">No activity yet. Email, log a call, or add a note to start the history.</p>
        ) : (
          <div className="border border-line rounded-xl divide-y divide-line">
            {contactActivities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-3.5 py-3">
                <div className="mt-0.5 w-7 h-7 rounded-full bg-brick-tint text-brick flex items-center justify-center shrink-0">
                  <ActivityIcon type={a.activity_type} hasRevenue={!!a.revenue_cents} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-semibold text-ink">{ACTIVITY_LABELS[a.activity_type]}</span>
                    <span className="text-[11.5px] text-muted-2 shrink-0 tabular-nums">{a.activity_date === today ? "Today" : fmtDate(a.activity_date)}</span>
                  </div>
                  {(a.revenue_cents || a.loggedBy) && (
                    <div className="text-[12px] text-muted-2 mt-0.5">
                      {a.revenue_cents ? <span className="text-[#15803D] font-medium">{money(a.revenue_cents)}</span> : ""}
                      {a.revenue_cents && a.loggedBy ? " · " : ""}
                      {a.loggedBy ? `by ${a.loggedBy}` : ""}
                    </div>
                  )}
                  {a.notes && <div className="text-[13px] text-charcoal-2 mt-1 whitespace-pre-wrap">{a.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
