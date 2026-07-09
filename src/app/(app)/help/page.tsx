import { CATEGORIES, ARTICLES } from "@/lib/help-content";
import { HelpBrowser } from "./help-browser";

export default function HelpPage() {
  return (
    <>
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink mb-1.5">Help Center</h1>
        <p className="text-base text-muted">Search for how anything works, or browse by topic.</p>
      </div>
      <HelpBrowser categories={CATEGORIES} articles={ARTICLES} />
    </>
  );
}
