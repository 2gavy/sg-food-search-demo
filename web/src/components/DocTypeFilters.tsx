const FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: "All venues" },
  { value: "hawker_stall", label: "Hawker stall" },
  { value: "restaurant", label: "Restaurant" },
];

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function DocTypeFilters({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-3 border-t border-slate-100">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-1 shrink-0">
        Type
      </span>
      {FILTERS.map((f) => (
        <button
          key={String(f.value)}
          type="button"
          onClick={() => onChange(f.value)}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full border min-h-[32px] touch-manipulation transition-colors capitalize ${
            value === f.value
              ? "bg-brand text-white border-brand shadow-sm"
              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white"
          }`}
        >
          {f.label}
        </button>
      ))}
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 text-xs px-2.5 py-1.5 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 min-h-[32px] touch-manipulation transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
