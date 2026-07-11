import { Loader2, type LucideIcon } from "lucide-react";

const KIND_CLASSES = {
  primary: "bg-brick text-white border border-brick hover:bg-brick-dark hover:border-brick-dark disabled:bg-muted-2 disabled:border-muted-2",
  ghost: "bg-panel text-ink border border-line-strong hover:bg-paper hover:border-muted-2",
  danger: "bg-panel text-danger border border-danger-tint hover:bg-danger-tint",
  info: "bg-[#2563EB] text-white border border-[#2563EB] hover:bg-[#1D4ED8] hover:border-[#1D4ED8] disabled:bg-muted-2 disabled:border-muted-2",
} as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: keyof typeof KIND_CLASSES;
  icon?: LucideIcon;
  small?: boolean;
  // When true, the icon is replaced by a spinning loader and the button is
  // disabled — so slow actions (especially AI generation) visibly show they're
  // still working, not stalled.
  loading?: boolean;
};

export function Btn({ children, kind = "primary", icon: Icon, small, loading, className, disabled, ...rest }: ButtonProps) {
  const iconSize = small ? 13 : 15;
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`flex items-center gap-1.5 rounded-[10px] font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
        small ? "px-3 py-1.5 text-xs" : "px-[22px] py-[11px] text-[15px]"
      } ${KIND_CLASSES[kind]} ${className ?? ""}`}
    >
      {loading ? <Loader2 size={iconSize} className="animate-spin" /> : Icon ? <Icon size={iconSize} /> : null}
      {children}
    </button>
  );
}
