import Link from "next/link";

export function CtaSection() {
  return (
    <div className="bg-paper">
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-20 sm:py-32 text-center">
        <h2 className="font-display text-4xl sm:text-5xl lg:text-[64px] leading-[1.04] tracking-[-0.03em] font-bold text-ink mb-6">
          Set the standard.
          <br />
          Then keep it.
        </h2>
        <p className="text-lg sm:text-[21px] text-muted leading-[1.5] max-w-[560px] mx-auto mb-10">
          Bring your whole team onto one system for culture, training, and accountability — live
          on your first shift.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="text-[17px] font-semibold text-white bg-brick rounded-full px-8 py-[15px] hover:bg-brick-dark transition-colors"
          >
            Set up your organization
          </Link>
          <Link
            href="/book-a-demo"
            className="text-[17px] font-semibold text-ink bg-white border border-line-strong rounded-full px-[30px] py-3.5 hover:bg-[#efefef] transition-colors"
          >
            Book a Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
