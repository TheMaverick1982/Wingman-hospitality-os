export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-1.5 text-ink">{label}</label>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm border border-line bg-white text-ink";
