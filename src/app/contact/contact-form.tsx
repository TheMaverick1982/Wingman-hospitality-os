"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Send } from "lucide-react";
import { HONEYPOT_FIELD } from "@/lib/honeypot";
import { submitContact } from "./actions";
import { TRANSACTIONAL_CONSENT, MARKETING_CONSENT } from "./consent";

const INPUT =
  "w-full rounded-[10px] px-[14px] py-[11px] text-[15px] border border-line-strong bg-panel text-ink outline-none transition-shadow duration-150 focus:border-brick focus:ring-[3px] focus:ring-brick-tint";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [optInTransactional, setOptInTransactional] = useState(false);
  const [optInMarketing, setOptInMarketing] = useState(false);
  const [hp, setHp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await submitContact({ name, email, phone, message, optInTransactional, optInMarketing, hp });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="bg-white border border-line rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-olive-tint text-[#15803D] flex items-center justify-center mx-auto mb-4">
          <Check size={28} />
        </div>
        <h2 className="font-display text-2xl font-semibold text-ink mb-2">Thanks — we got it.</h2>
        <p className="text-muted">We&apos;ll get back to you at {email} shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white border border-line rounded-2xl shadow-sm p-6 sm:p-8">
      {/* Honeypot — hidden from real users. */}
      <input
        type="text"
        name={HONEYPOT_FIELD}
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-semibold mb-1.5 text-ink">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="Jane Doe" />
        </div>
        <div>
          <label className="block text-[13px] font-semibold mb-1.5 text-ink">Mobile phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className={INPUT} placeholder="(555) 123-4567" />
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-[13px] font-semibold mb-1.5 text-ink">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={INPUT} placeholder="jane@restaurant.com" />
      </div>
      <div className="mt-4">
        <label className="block text-[13px] font-semibold mb-1.5 text-ink">How can we help?</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className={`${INPUT} min-h-[110px]`} placeholder="Tell us what you're looking for." />
      </div>

      {/* SMS opt-ins — separate, unchecked by default. */}
      <div className="mt-5 flex flex-col gap-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={optInTransactional} onChange={(e) => setOptInTransactional(e.target.checked)} className="mt-1 w-4 h-4 accent-[#0a6cff] shrink-0" />
          <span className="text-[13px] text-charcoal-2 leading-[1.5]">{TRANSACTIONAL_CONSENT}</span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={optInMarketing} onChange={(e) => setOptInMarketing(e.target.checked)} className="mt-1 w-4 h-4 accent-[#0a6cff] shrink-0" />
          <span className="text-[13px] text-charcoal-2 leading-[1.5]">{MARKETING_CONSENT}</span>
        </label>
      </div>

      <p className="text-xs text-muted mt-4 leading-[1.5]">
        By submitting, you agree to our{" "}
        <Link href="/privacy" className="text-brick font-medium">Privacy Policy</Link> and{" "}
        <Link href="/terms" className="text-brick font-medium">Terms</Link>. Mobile opt-in and consent are never shared
        with or sold to third parties. Message and data rates may apply; reply STOP to opt out, HELP for help.
      </p>

      {error && <p className="text-danger text-sm mt-3">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-brick text-white font-semibold px-6 py-3 text-sm hover:bg-brick-dark transition-colors disabled:opacity-40"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send message
      </button>
    </form>
  );
}
