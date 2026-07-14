import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { SAMPLE_CARDS } from "@/lib/social-cards/samples";

export const metadata: Metadata = { title: "Card preview · Social" };
export const dynamic = "force-dynamic";

// Preview gallery: renders every card type across all three color schemes so the
// look can be approved before the generator is wired to produce and publish them.
export default async function CardPreviewPage() {
  await requirePlatformSection("social");

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <Link href="/admin/social" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-2 hover:text-brick transition-colors mb-3">
          <ArrowLeft size={14} /> Social
        </Link>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Card style preview</h1>
        <p className="text-base text-muted max-w-2xl">
          The auto-generated post cards — every layout across the three color schemes (blue, charcoal, cream), rendered
          from the template with the Wingman plane and Inter, auto-fit so text never clips. The AI writes the words; the
          template draws the card. Facebook &amp; Instagram get these; LinkedIn is text-only.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {SAMPLE_CARDS.map((c, i) => (
          <figure key={i} className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/admin/social/card-preview?sample=${i}&size=720`}
              alt={`${c.type} card, ${c.scheme}`}
              width={720}
              height={720}
              className="w-full aspect-square rounded-xl border border-line shadow-sm"
            />
            <figcaption className="text-[12px] text-muted-2">
              <span className="font-semibold text-charcoal-2">{c.type}</span> · {c.scheme}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
