import type { LucideIcon } from "lucide-react";

const KIND_CLASSES = {
  primary: "bg-charcoal text-white border border-charcoal disabled:bg-[#B8AF9F] disabled:border-[#B8AF9F]",
  ghost: "bg-white text-ink border border-line",
  danger: "bg-white text-brick border border-brick-tint",
} as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: keyof typeof KIND_CLASSES;
  icon?: LucideIcon;
  small?: boolean;
};

export function Btn({ children, kind = "primary", icon: Icon, small, className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`flex items-center gap-1.5 rounded-lg font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed ${
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
      } ${KIND_CLASSES[kind]} ${className ?? ""}`}
    >
      {Icon && <Icon size={small ? 13 : 15} />}
      {children}
    </button>
  );
}
