export function ConciergeLoading() {
  return (
    <div className="flex justify-start" aria-live="polite" aria-busy="true">
      <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-emerald-100 bg-gradient-to-br from-slate-50 to-emerald-50/60 px-3.5 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-medium text-emerald-900">Agent Builder is generating</span>
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">Reading your selection and drafting a reply…</p>
      </div>
    </div>
  );
}
