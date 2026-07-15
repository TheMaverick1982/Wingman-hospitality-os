import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveCertVersion } from "@/lib/sales-cert";
import { TakeCert, type ClientQuestion } from "./take-client";

export const metadata = { title: "Take the certification · Admin" };
// Generating a fresh version (when the playbook changed) is an AI call — give it room.
export const maxDuration = 60;

export default async function TakeCertPage() {
  const profile = await getCurrentProfile();
  if (!profile?.isPlatformAdmin) redirect("/dashboard");

  const { version, error } = await getActiveCertVersion();
  if (!version) {
    return (
      <div className="max-w-xl bg-white border border-line rounded-2xl p-6 shadow-sm">
        <h1 className="text-lg font-bold text-ink mb-1">Test not ready</h1>
        <p className="text-sm text-muted">{error ?? "The certification couldn't be generated right now. Try again in a moment."}</p>
        <Link href="/admin/sales-training/certification/take" className="inline-block mt-4 mr-4 text-white bg-brick rounded-full px-4 py-2 font-semibold text-sm">Try again</Link>
        <Link href="/admin/sales-training/certification" className="inline-block mt-4 text-brick font-semibold text-sm">← Back</Link>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: qRows } = await admin
    .from("sales_cert_questions")
    .select("id, section, kind, prompt, options, sort_order")
    .eq("version_id", version.id)
    .order("sort_order");
  // Never send correct_index/explanation to the browser.
  const questions: ClientQuestion[] = ((qRows ?? []) as { id: string; section: string; kind: string; prompt: string; options: string[] }[]).map((q) => ({
    id: q.id,
    section: q.section,
    kind: q.kind === "roleplay" ? "roleplay" : "mcq",
    prompt: q.prompt,
    options: q.kind === "roleplay" ? [] : (q.options ?? []),
  }));

  return <TakeCert versionId={version.id} questions={questions} />;
}
