const COLUMNS = [
  { label: "Keywords", dot: "bg-slate-400" },
  { label: "E5", dot: "bg-sky-500" },
  { label: "Jina", dot: "bg-brand" },
] as const;

export function ColumnLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
      {COLUMNS.map((col) => (
        <span key={col.label} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} aria-hidden />
          {col.label}
        </span>
      ))}
    </div>
  );
}
