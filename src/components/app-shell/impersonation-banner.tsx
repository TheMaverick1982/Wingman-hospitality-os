import { LogOut } from "lucide-react";
import { exitImpersonation } from "@/app/admin/organizations/actions";

export function ImpersonationBanner({ viewingName }: { viewingName: string }) {
  return (
    <div className="bg-ink text-white px-5 py-2.5 flex items-center justify-between gap-4 text-sm">
      <span>
        Viewing as <span className="font-semibold">{viewingName}</span> — platform admin session
      </span>
      <form action={exitImpersonation}>
        <button type="submit" className="inline-flex items-center gap-1.5 font-semibold hover:opacity-80 transition-opacity">
          <LogOut size={14} /> Return to admin
        </button>
      </form>
    </div>
  );
}
