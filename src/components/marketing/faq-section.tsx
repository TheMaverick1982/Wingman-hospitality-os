// Homepage FAQ. Doubles as (1) on-page keyword real estate — the answers say the
// literal phrases restaurant operators search ("restaurant staff training
// software", "get guests to come back", "multi-location") out loud — and (2) a
// FAQPage rich result. The visible copy and the JSON-LD are generated from the
// same source so they can never drift (a Google requirement).

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Wingman?",
    a: "Wingman is restaurant staff training and guest-retention software — the culture, training, and accountability system hospitality teams use every shift to turn first-time guests into regulars. It replaces the training binder, the checklists, and the guesswork with one place your team actually uses on the floor.",
  },
  {
    q: "How do I get restaurant guests to come back?",
    a: "The cheapest way to grow a restaurant is bringing back the guests you already won. Wingman makes that a habit: your team flags every first-time guest, follows a simple service-recovery and bounce-back play to give them a reason to return, and you track your repeat rate as a real trend over time — so you can see whether guests are actually coming back.",
  },
  {
    q: "How does Wingman train restaurant staff?",
    a: "Wingman delivers role-by-role training and sign-offs for every position — host, server, bartender, and kitchen — plus pre-shift rituals, SOP checklists, and spot-checks that keep standards alive on the off-night. Managers assign training, verify it on the floor, and coach in the moment instead of hoping it stuck.",
  },
  {
    q: "Does Wingman work for multi-location restaurants and franchises?",
    a: "Yes. Wingman is built for multi-location restaurant operations and franchises: your culture, standards, and guest journey are portable across every location, with per-location accountability and reporting so each site runs to the same standard.",
  },
  {
    q: "How much does Wingman cost?",
    a: "Wingman is $199 per location, per month. You can try a fully-loaded live demo with no signup, run your retention upside on the calculator, or book a call to see it on your own floor.",
  },
];

export function FaqSection() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="bg-panel" aria-labelledby="faq-heading">
      <div className="max-w-[860px] mx-auto px-6 sm:px-10 py-20 sm:py-32">
        <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-brick mb-5">FAQ</div>
        <h2 id="faq-heading" className="font-display text-[32px] sm:text-[44px] leading-[1.05] tracking-[-0.028em] font-bold text-ink mb-12 sm:mb-16">
          Restaurant staff training and guest retention, answered
        </h2>
        <dl className="flex flex-col divide-y divide-line border-t border-line">
          {FAQS.map((f) => (
            <div key={f.q} className="py-7 sm:py-8 grid sm:grid-cols-[1fr_1.4fr] gap-3 sm:gap-8">
              <dt className="text-lg sm:text-xl font-semibold tracking-[-0.015em] text-ink">{f.q}</dt>
              <dd className="text-[15px] sm:text-base text-muted leading-[1.6]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
