const OPTIONS = [
  { value: "halal", label: "Halal" },
  { value: "vegetarian-friendly", label: "Veg-friendly" },
] as const;

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
}

export function DietaryFilters({ value, onChange }: Props) {
  const toggle = (tag: string) => {
    if (value.includes(tag)) onChange(value.filter((t) => t !== tag));
    else onChange([...value, tag]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-1 shrink-0">
        Diet
      </span>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full border min-h-[32px] touch-manipulation transition-colors ${
            value.includes(opt.value)
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="shrink-0 text-xs px-2.5 py-1.5 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 min-h-[32px] touch-manipulation"
        >
          Clear
        </button>
      )}
    </div>
  );
}
