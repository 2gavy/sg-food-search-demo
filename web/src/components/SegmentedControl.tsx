interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  compact?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  compact = false,
}: Props<T>) {
  const pad = compact ? "px-4" : "px-5";

  return (
    <div
      className="inline-flex shrink-0 rounded-lg border border-slate-300 bg-white shadow-sm"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt, i) => {
        const active = value === opt.value;
        const isFirst = i === 0;
        const isLast = i === options.length - 1;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`${pad} py-2.5 text-sm whitespace-nowrap min-h-[44px] touch-manipulation transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ${
              !isFirst ? "border-l border-slate-300" : ""
            } ${isFirst ? "rounded-l-lg" : ""} ${isLast ? "rounded-r-lg" : ""} ${
              active
                ? "bg-brand text-white font-semibold"
                : "text-slate-800 font-medium hover:bg-slate-50 active:bg-slate-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
