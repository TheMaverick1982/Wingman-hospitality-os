import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/profile";
import { IDEA_SORTS, type IdeaSort } from "@/lib/feature-ideas";
import { getIdeas } from "@/lib/feature-ideas-data";
import { SubmitIdea, IdeaList } from "./features-client";

export const metadata: Metadata = { title: "Feature ideas" };

export default async function FeaturesPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const { sort: sortParam } = await searchParams;
  const sort: IdeaSort = sortParam === "most" || sortParam === "least" ? sortParam : "newest";
  const ideas = await getIdeas(sort);

  return (
    <div className="max-w-[760px] mx-auto w-full flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Feature ideas</h1>
        <p className="text-base text-muted mt-1 max-w-xl">
          Tell us what you&rsquo;d love Wingman to do — and vote for the ideas you want most. We read every one. Votes are
          anonymous; no one sees who suggested what.
        </p>
      </div>

      <SubmitIdea />

      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-muted-2 mr-1">Sort:</span>
        {IDEA_SORTS.map((s) => (
          <Link
            key={s.key}
            href={`/features?sort=${s.key}`}
            className={`text-[13px] font-semibold rounded-full px-3 py-1.5 border transition-colors ${
              sort === s.key ? "bg-charcoal text-white border-charcoal" : "bg-white text-charcoal-2 border-line hover:border-brick"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <IdeaList ideas={ideas} isPlatformAdmin={profile.isPlatformAdmin} />
    </div>
  );
}
