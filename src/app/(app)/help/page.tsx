import Link from "next/link";
import { LifeBuoy, ArrowUpRight } from "lucide-react";
import { CATEGORIES, ARTICLES } from "@/lib/help-content";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { HelpBrowser } from "./help-browser";
import { PlaybookSection } from "./playbook-editor";
import type { PlaybookArticle } from "./playbook-actions";

// The playbook's "Write with AI" runs a model call from this route; give it room
// to finish instead of hitting the platform's short default function timeout.
export const maxDuration = 60;

export default async function HelpPage() {
  const profile = await getCurrentProfile();
  // Staff get a focused Help: just their team's playbook (plus the always-on AI
  // assistant widget). The product Help Center and support tickets are for
  // owners/managers.
  const isStaff = profile?.accessRole === "staff";
  const supabase = await createClient();
  const { data: playbook } = await supabase
    .from("playbook_articles")
    .select("id, title, body, sort_order, updated_at")
    .order("sort_order", { ascending: true });

  return (
    <>
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Help Center</h1>
        <p className="text-base text-muted">
          {isStaff ? "Your team's playbook — and ask the assistant anytime." : "Search for how anything works, or browse by topic."}
        </p>
      </div>

      <PlaybookSection
        articles={(playbook ?? []) as PlaybookArticle[]}
        canEdit={profile?.accessRole === "super_admin"}
      />

      {!isStaff && <HelpBrowser categories={CATEGORIES} articles={ARTICLES} />}

      {!isStaff && (
        <Link
          href="/support"
          className="flex items-center gap-4 bg-white border border-line rounded-2xl p-5 shadow-sm hover:border-brick transition-colors group"
        >
          <span className="w-11 h-11 rounded-[12px] bg-brick-tint text-brick flex items-center justify-center shrink-0">
            <LifeBuoy size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink">Still need help? Contact support</div>
            <div className="text-[13px] text-muted-2">Open a ticket and our team will get back to you by email and here.</div>
          </div>
          <ArrowUpRight size={17} className="text-muted-2 shrink-0 group-hover:text-brick transition-colors" />
        </Link>
      )}
    </>
  );
}
