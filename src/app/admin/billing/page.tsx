import { CreditCard } from "lucide-react";
import { requirePlatformSection } from "@/lib/auth/require-platform";

export default async function AdminBillingPage() {
  await requirePlatformSection("billing");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Billing</h1>
        <p className="text-sm text-muted mt-1">Per-organization subscriptions and revenue.</p>
      </div>

      <div className="bg-white border border-line rounded-2xl p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-brick-tint flex items-center justify-center mx-auto mb-5">
          <CreditCard size={22} className="text-brick" />
        </div>
        <p className="text-sm font-semibold text-ink mb-2">Billing isn&apos;t connected yet</p>
        <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
          This panel will show subscription status, plan tier, and revenue per organization once a
          payment processor (Stripe or Global Payments) is connected.
        </p>
      </div>
    </div>
  );
}
