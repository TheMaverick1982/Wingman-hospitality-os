import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { PlaybookBody } from "../../playbook-body";

export default async function PlaybookArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  // RLS scopes this to the caller's org, so an id from another org returns nothing.
  const { data: article } = await supabase
    .from("playbook_articles")
    .select("id, title, body, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!article) notFound();

  return (
    <div className="max-w-2xl w-full mx-auto">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink mb-6">
        <ArrowLeft size={15} /> All help
      </Link>

      <div className="bg-white border border-line rounded-2xl shadow-sm p-8">
        <div className="text-[13px] font-semibold text-brick uppercase tracking-wide mb-2">Team playbook</div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink mb-6">{article.title}</h1>
        <div className="border-t border-line pt-6">
          {article.body ? (
            <PlaybookBody body={article.body as string} />
          ) : (
            <p className="text-sm text-muted">This guide is empty.</p>
          )}
        </div>
      </div>

      <p className="text-[13px] text-muted-2 text-center mt-6">
        Last updated {new Date(article.updated_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}
