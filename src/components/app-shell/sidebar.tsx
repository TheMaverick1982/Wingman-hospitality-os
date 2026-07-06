"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Heart,
  RotateCcw,
  Receipt,
  GraduationCap,
  AlertTriangle,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/culture", label: "Culture", icon: Heart },
  { href: "/bounceback", label: "Guest Bounce Back", icon: RotateCcw },
  { href: "/recovery", label: "Service Recovery", icon: Receipt },
  { href: "/training", label: "Training & Standards", icon: GraduationCap },
  { href: "/accountability", label: "Accountability", icon: AlertTriangle },
  { href: "/hiring", label: "Hiring", icon: Briefcase },
];

export function Sidebar({ orgName, isGm }: { orgName: string; isGm: boolean }) {
  const pathname = usePathname();

  return (
    <div className="bg-charcoal w-[230px] shrink-0 p-5 flex flex-col">
      <div className="mb-8">
        <div className="text-white font-display text-xl font-semibold leading-tight">Wingman</div>
        <div className="text-[#98989d] text-xs mt-0.5 tracking-wide uppercase">{orgName}</div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5 ${
                active ? "bg-white/[0.08] text-white" : "text-[#aeaeb2]"
              }`}
            >
              <item.icon size={16} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-white/10">
        {!isGm && (
          <p className="text-[#8e8e93] text-xs leading-relaxed">
            Only a General Manager can edit the training system.
          </p>
        )}
      </div>
    </div>
  );
}
