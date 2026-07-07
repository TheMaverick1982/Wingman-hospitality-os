import { X } from "lucide-react";

export function Modal({
  title,
  sub,
  onClose,
  children,
  wide,
}: {
  title: string;
  sub?: string;
  onClose?: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 flex items-start justify-center p-6 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <div className={`w-full mt-8 mb-8 bg-panel rounded-[18px] shadow-lg overflow-hidden ${wide ? "max-w-[720px]" : "max-w-[560px]"}`}>
        <div className="flex items-start justify-between p-6 border-b border-line">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
            {sub && <p className="text-sm mt-1 text-muted">{sub}</p>}
          </div>
          {onClose && (
            <button onClick={onClose} className="text-muted" type="button">
              <X size={20} />
            </button>
          )}
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
