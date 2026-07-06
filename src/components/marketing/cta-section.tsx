import Link from "next/link";

export function CtaSection() {
  return (
    <section className="bg-charcoal py-24 px-6 text-center">
      <div className="max-w-2xl mx-auto">
        <p className="font-display text-2xl sm:text-3xl text-white leading-snug mb-4">
          &quot;We can send all the customers we want to a restaurant — if they don&apos;t come back,
          that&apos;s not good.&quot;
        </p>
        <p className="text-[#98989d] text-sm mb-10">
          Everything in Wingman exists to move guests from Visit 1 to Visit 4 — and keep them there.
        </p>
        <Link
          href="/signup"
          className="inline-block text-base font-semibold text-charcoal bg-white rounded-full px-8 py-3.5 hover:opacity-85 transition-opacity"
        >
          Set up your organization
        </Link>
      </div>
    </section>
  );
}
