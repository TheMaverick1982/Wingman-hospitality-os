import { Rocket, LayoutGrid, Users, ClipboardCheck, TrendingUp, Plug, Settings, type LucideIcon } from "lucide-react";
import type { HelpIcon as HelpIconKey } from "@/lib/help-content";

const MAP: Record<HelpIconKey, LucideIcon> = {
  rocket: Rocket,
  layout: LayoutGrid,
  users: Users,
  clipboard: ClipboardCheck,
  trending: TrendingUp,
  plug: Plug,
  settings: Settings,
};

export function HelpIcon({ name, size = 18, className }: { name: HelpIconKey; size?: number; className?: string }) {
  const Icon = MAP[name] ?? Rocket;
  return <Icon size={size} className={className} />;
}
