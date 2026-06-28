interface Props {
  label: string;
  onBack: () => void;
}

export function SearchBreadcrumb({ label, onBack }: Props) {
  return (
    <nav
      className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600"
      aria-label="Search context"
    >
      <button
        type="button"
        onClick={onBack}
        className="font-medium text-brand-dark hover:text-brand hover:underline touch-manipulation"
      >
        Discover
      </button>
      <span className="text-slate-300" aria-hidden>
        ›
      </span>
      <span className="text-slate-800 font-medium truncate max-w-[min(100%,280px)]">{label}</span>
    </nav>
  );
}
