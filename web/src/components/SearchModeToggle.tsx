interface Props {
  mode: "text" | "photo";
  onChange: (mode: "text" | "photo") => void;
}

export function SearchModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex w-full sm:inline-flex rounded-lg border border-slate-300 overflow-hidden bg-white">
      {(["text", "photo"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`flex-1 sm:flex-none px-4 py-3 sm:py-2 text-sm font-medium capitalize min-h-[44px] touch-manipulation ${
            mode === m ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50 active:bg-slate-100"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
