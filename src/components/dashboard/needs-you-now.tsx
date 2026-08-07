import Link from "next/link";
import { MessageCircleQuestion, Briefcase, MessageSquareHeart, ArrowRight, type LucideIcon } from "lucide-react";

export type NeedKey = "questions" | "applicants" | "feedback";
export type NeedItem = { key: NeedKey; label: string; href: string };

const ICONS: Record<NeedKey, LucideIcon> = {
  questions: MessageCircleQuestion,
  applicants: Briefcase,
  feedback: MessageSquareHeart,
};

// Mobile-only "Needs you now": the 2–3 live things a manager should act on right
// now, at the very top of the phone dashboard, so the phone answers "what's my
// next move?" instead of "where do I navigate?" Hidden on desktop (lg:hidden),
// and renders nothing when there's nothing waiting.
export function NeedsYouNow({ items }: { items: NeedItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="lg:hidden bg-white border border-line rounded-2xl p-5 shadow-sm">
      <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-2 mb-3">Needs you now</div>
      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const Icon = ICONS[it.key];
          return (
            <Link
              key={it.key}
              href={it.href}
              className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 hover:border-brick transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-brick-tint text-brick flex items-center justify-center shrink-0">
                <Icon size={17} />
              </span>
              <span className="flex-1 min-w-0 text-[14.5px] text-ink leading-snug">{it.label}</span>
              <ArrowRight size={16} className="text-muted-2 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
