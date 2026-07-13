import Link from "next/link";

// Shown on content that's still a seeded starting sample (before the Setup
// Wizard personalizes it), so a new owner knows it's a template to make theirs.
export function SampleRibbon({ what }: { what: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-gold-tint border border-[#F0D9A8] px-4 py-2.5 mb-3 text-[13px]">
      <span className="font-semibold text-[#B45309]">✨ Sample {what}</span>
      <span className="text-[#B45309]/90">— a starting template. Make it yours in 3 minutes.</span>
      <Link href="/wizard" className="font-semibold text-[#B45309] underline underline-offset-2 hover:opacity-80">
        Personalize with the wizard →
      </Link>
    </div>
  );
}
