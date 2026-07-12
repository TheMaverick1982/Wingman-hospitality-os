import type { Metadata } from "next";
import { requirePlatformSection } from "@/lib/auth/require-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeCoupon, type Coupon } from "@/lib/coupons";
import { CouponForm } from "./coupon-form";
import { toggleCoupon, deleteCoupon } from "./actions";

export const metadata: Metadata = { title: "Coupons · Admin" };

export default async function CouponsPage() {
  await requirePlatformSection("coupons");
  const admin = createAdminClient();
  const { data } = await admin.from("coupons").select("*").order("created_at", { ascending: false });
  const coupons = (data ?? []) as Coupon[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink">Coupons</h1>
        <p className="text-sm text-muted mt-1">
          Discount codes and free trials. Customers can enter a code at signup, or apply one to an account from its admin page.
          Trials take effect immediately; dollar discounts apply once billing is connected.
        </p>
      </div>

      <CouponForm />

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs font-semibold uppercase tracking-wide text-muted-2">
              <th className="px-5 py-3">Code</th>
              <th className="px-5 py-3">Terms</th>
              <th className="px-5 py-3">Redeemed</th>
              <th className="px-5 py-3">Expires</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-5 py-4 font-mono font-semibold text-ink">{c.code}</td>
                <td className="px-5 py-4 text-charcoal-2">
                  {describeCoupon(c)}
                  {c.description && <div className="text-[12px] text-muted-2 mt-0.5">{c.description}</div>}
                </td>
                <td className="px-5 py-4 text-charcoal-2 tabular-nums">
                  {c.redeemed_count}
                  {c.max_redemptions != null ? ` / ${c.max_redemptions}` : ""}
                </td>
                <td className="px-5 py-4 text-charcoal-2">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                <td className="px-5 py-4">
                  <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${c.active ? "text-olive bg-olive-tint" : "text-muted bg-paper"}`}>
                    {c.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-4 text-right whitespace-nowrap">
                  <form action={toggleCoupon} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="active" value={(!c.active).toString()} />
                    <button type="submit" className="text-[13px] font-semibold text-charcoal-2 hover:text-brick px-2">
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                  <form action={deleteCoupon} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-[13px] font-semibold text-muted-2 hover:text-danger px-2">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  No coupons yet. Create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
