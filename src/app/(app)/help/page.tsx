import { CATEGORIES, ARTICLES } from "@/lib/help-content";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { HelpBrowser } from "./help-browser";
import { PlaybookSection } from "./playbook-editor";
import type { PlaybookArticle } from "./playbook-actions";

export default async function HelpPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: playbook } = await supabase
    .from("playbook_articles")
    .select("id, title, body, sort_order, updated_at")
    .order("sort_order", { ascending: true });

  return (
    <>
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Help Center</h1>
        <p className="text-base text-muted">Search for how anything works, or browse by topic.</p>
      </div>

      <PlaybookSection
        articles={(playbook ?? []) as PlaybookArticle[]}
        canEdit={profile?.accessRole === "super_admin"}
      />

      <HelpBrowser categories={CATEGORIES} articles={ARTICLES} />
    </>
  );
}
