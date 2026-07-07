export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[13px] font-semibold mb-1.5 text-ink">{label}</label>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-[10px] px-[14px] py-[11px] text-[15px] border border-line-strong bg-panel text-ink outline-none transition-shadow duration-150 focus:border-brick focus:ring-[3px] focus:ring-brick-tint disabled:bg-paper disabled:text-muted-2 disabled:border-line disabled:cursor-not-allowed";
