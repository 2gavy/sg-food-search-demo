interface Props {
  variant?: "idle" | "loading";
  isUpload?: boolean;
}

export function PhotoSearchNotice({ variant = "idle", isUpload = false }: Props) {
  if (variant === "loading") {
    return (
      <div
        className="rounded-lg border border-violet-200 bg-violet-50/90 px-3 py-3 sm:py-2.5 flex gap-3 items-start"
        role="status"
        aria-live="polite"
      >
        <span className="mt-0.5 shrink-0 inline-block h-4 w-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-violet-900">
            {isUpload ? "Analyzing your upload…" : "Analyzing dish photo…"}
          </p>
          <p className="text-xs text-violet-800/90 mt-0.5 leading-snug">
            Photo search runs Jina multimodal embedding on Elastic Inference — typically a few seconds,
            longer for large camera uploads.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 leading-snug">
      <p>
        <span className="font-semibold text-slate-800">Photo search is slower than text</span> — the
        model embeds the whole image (not just words). Gallery picks are fastest; large uploads can
        take longer.
      </p>
      <p className="mt-1 text-slate-500">
        Lexical cannot search photos · E5 uses dish name only · Jina matches visually
      </p>
    </div>
  );
}
