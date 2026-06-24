import type { CompareResponse } from "../types/venue";

interface Props {
  result: CompareResponse;
  previewImage?: string | null;
}

export function PhotoMatchSummary({ result, previewImage }: Props) {
  const jinaN = result.hybrid_jina.hits.length;
  const ossN = result.hybrid_oss.hits.length;
  const oss = result.hybrid_oss;
  const totalMs = result.lexical.took_ms + oss.took_ms + result.hybrid_jina.took_ms;
  const jinaOnly = result.diff.jina_only.length;
  const ossOnly = result.diff.oss_only.length;

  const dishLabel = result.query.replace(/^\[photo:/, "").replace(/\]$/, "");
  const isUpload = dishLabel === "uploaded photo";

  let note: string;
  if (oss.unsupported) {
    note = "Jina matches venues by image. Keywords and raw uploads can't use E5 — pick a gallery dish to compare.";
  } else if (jinaOnly > 0 || ossOnly > 0) {
    note = `${jinaOnly + ossOnly} venue${jinaOnly + ossOnly === 1 ? "" : "s"} differ — Jina uses the photo, E5 uses the dish name as text.`;
  } else {
    note = "Same venues from visual search (Jina) and text proxy (E5).";
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-3 sm:px-4 py-3 flex gap-3 sm:gap-4 items-center">
        {previewImage ? (
          <img
            src={previewImage}
            alt="Search photo"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-200 shrink-0 shadow-sm"
          />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-violet-50 border border-violet-200 shrink-0 flex items-center justify-center text-2xl">
            📷
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">Visual match</p>
          <p className="text-sm sm:text-base font-semibold text-slate-900 leading-snug truncate">
            {isUpload ? "Your photo" : dishLabel.replace(/_/g, " ")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed line-clamp-2">{note}</p>
        </div>

        <div className="hidden sm:grid grid-cols-3 gap-2 shrink-0 w-[min(100%,200px)]">
          <Stat label="Jina" value={String(jinaN)} highlight={jinaN > 0} />
          <Stat
            label="E5"
            value={oss.unsupported ? "—" : String(ossN)}
            muted={oss.unsupported}
            highlight={!oss.unsupported && ossN > 0}
          />
          <Stat label="Time" value={`${totalMs}ms`} />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  muted = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-2 py-1.5 text-center ${
        highlight ? "bg-emerald-50 ring-1 ring-emerald-100" : "bg-slate-50"
      }`}
    >
      <p className="text-[9px] uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`text-sm font-semibold tabular-nums ${
          highlight ? "text-brand-dark" : muted ? "text-slate-400" : "text-slate-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
