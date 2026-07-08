export function QuoteSection() {
  return (
    <div className="bg-[#0a0a0a] text-white">
      <div className="max-w-[940px] mx-auto px-6 sm:px-10 py-24 sm:py-[140px] text-center">
        <div className="text-[15px] font-semibold tracking-[0.08em] uppercase text-brick mb-10">Why Wingman exists</div>
        <blockquote className="font-display text-3xl sm:text-4xl lg:text-[48px] leading-[1.16] tracking-[-0.02em] font-semibold m-0 mb-8">
          &quot;We can send all the customers we want to a restaurant — if they don&apos;t come
          back, that&apos;s not good.&quot;
        </blockquote>
        <p className="text-lg sm:text-[19px] text-[#a1a1a1]">
          Everything in Wingman exists to move guests from Visit 1 to Visit 4 — and keep them
          returning for life.
        </p>
      </div>
    </div>
  );
}
