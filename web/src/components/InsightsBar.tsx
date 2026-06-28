import type { CompareResponse } from "../types/venue";

interface Props {
  result: CompareResponse;
  previewImage?: string | null;
  onSelectHit?: (docId: string, column: "oss" | "jina") => void;
}

function formatExtra(count: number): string {
  return count > 0 ? `+${count}` : "0";
}

export function InsightsBar({ result, previewImage, onSelectHit }: Props) {
  const isPhoto = result.mode === "photo";
  const lex = result.lexical;
  const oss = result.hybrid_oss;
  const jina = result.hybrid_jina;
  const keywordBaseline = !lex.unsupported;

  const jinaExtra = result.diff.hybrid_only_jina.length;
  const ossExtra = result.diff.hybrid_only_oss.length;
  const jinaOnlyVsE5 = result.diff.jina_only.length;
  const ossOnlyVsE5 = result.diff.oss_only.length;
  const allThree = result.diff.all_three.length;
  const uniqueExtra = new Set([...result.diff.hybrid_only_jina, ...result.diff.hybrid_only_oss]).size;
  const totalMs = lex.took_ms + oss.took_ms + jina.took_ms;

  let note: string;
  if (isPhoto) {
    if (oss.unsupported) {
      note = "Jina matches by image. Keywords and raw uploads can't use E5 — pick a gallery dish to compare.";
    } else if (jinaOnlyVsE5 > 0 || ossOnlyVsE5 > 0) {
      const n = jinaOnlyVsE5 + ossOnlyVsE5;
      note = `${n} venue${n === 1 ? "" : "s"} differ — Jina uses the photo, E5 uses the dish name as text.`;
    } else {
      note = "Same venues from visual search (Jina) and text proxy (E5).";
    }
  } else if (lex.hits.length === 0 && (oss.hits.length > 0 || jina.hits.length > 0)) {
    note = "Hybrid search matched intent where keywords returned nothing.";
  } else if (uniqueExtra > 0) {
    note = `${uniqueExtra} venue${uniqueExtra === 1 ? "" : "s"} in hybrid top 10 not shown in keyword top 10.`;
  } else {
    note = "Same venues in all three columns — try mood or multilingual prompts to see extra recall.";
  }

  const showKeywordDiff = keywordBaseline && (jinaExtra > 0 || ossExtra > 0);
  const showHybridDiff = jinaOnlyVsE5 > 0 || ossOnlyVsE5 > 0;
  const hasDiff = showKeywordDiff || showHybridDiff;

  const jinaChipIds = keywordBaseline ? result.diff.hybrid_only_jina : result.diff.jina_only;
  const ossChipIds = keywordBaseline ? result.diff.hybrid_only_oss : result.diff.oss_only;

  const jinaNames = jina.hits.filter((h) => jinaChipIds.includes(h.doc_id)).map((h) => h.title);
  const ossNames = oss.hits.filter((h) => ossChipIds.includes(h.doc_id)).map((h) => h.title);

  const dishLabel = result.query.replace(/^\[photo:/, "").replace(/\]$/, "");
  const isUpload = dishLabel === "uploaded photo";
  const queryLabel = isPhoto ? (isUpload ? "Your photo" : dishLabel.replace(/_/g, " ")) : result.query;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-3 sm:px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1 flex gap-3">
          {isPhoto && (
            previewImage ? (
              <img
                src={previewImage}
                alt=""
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-slate-200 shrink-0 shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-violet-50 border border-violet-200 shrink-0 flex items-center justify-center text-violet-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
            )
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {isPhoto ? "Visual match" : "Query results"}
            </p>
            <p className="mt-0.5 text-sm sm:text-base font-semibold text-slate-900 leading-snug break-words line-clamp-2">
              {queryLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{note}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:w-[min(100%,420px)] lg:shrink-0">
          <Metric label="Keywords" value={String(lex.hits.length)} sub="BM25" />
          <Metric
            label="E5 extra"
            value={oss.unsupported ? "N/A" : formatExtra(ossExtra)}
            sub="vs BM25"
            highlight={!oss.unsupported && ossExtra > 0}
            muted={oss.unsupported}
          />
          <Metric label="Jina extra" value={formatExtra(jinaExtra)} sub="vs BM25" highlight={jinaExtra > 0} />
          <Metric label="Latency" value={`${totalMs}ms`} sub="total" />
        </div>
      </div>

      <div className="border-t border-slate-100 px-3 sm:px-4 py-2.5 bg-slate-50/60">
        {!hasDiff ? (
          <p className="text-xs sm:text-sm text-slate-500 text-center">
            {isPhoto
              ? "Jina and E5 returned the same venues for this photo."
              : "All three columns returned the same venues for this query."}
            {allThree > 0 && (
              <span className="text-amber-700 font-medium"> · ★ {allThree} in all three</span>
            )}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
              {keywordBaseline && jinaExtra > 0 && (
                <span>
                  <span className="font-semibold text-brand-dark">Jina</span> +{jinaExtra} not in keywords
                </span>
              )}
              {keywordBaseline && ossExtra > 0 && (
                <span>
                  <span className="font-semibold text-sky-700">E5</span> +{ossExtra} not in keywords
                </span>
              )}
              {showHybridDiff && (
                <span className="text-slate-500">
                  {jinaOnlyVsE5 > 0 && `${jinaOnlyVsE5} Jina-only`}
                  {jinaOnlyVsE5 > 0 && ossOnlyVsE5 > 0 && " · "}
                  {ossOnlyVsE5 > 0 && `${ossOnlyVsE5} E5-only`}
                  {!isPhoto && " vs other hybrid"}
                </span>
              )}
              {allThree > 0 && (
                <span className="text-amber-700 font-medium">★ {allThree} in all three</span>
              )}
            </div>
            {(jinaNames.length > 0 || ossNames.length > 0) && onSelectHit && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {jinaNames.slice(0, 3).map((name, i) => (
                  <button
                    key={`jina-${name}`}
                    type="button"
                    onClick={() => onSelectHit(jinaChipIds[i], "jina")}
                    className="text-xs bg-emerald-50 text-brand-dark border border-brand/25 px-2.5 py-1.5 rounded-full hover:bg-brand hover:text-white transition touch-manipulation min-h-[32px]"
                  >
                    {name.split("—")[0].trim()}
                  </button>
                ))}
                {ossNames.slice(0, 3).map((name, i) => (
                  <button
                    key={`oss-${name}`}
                    type="button"
                    onClick={() => onSelectHit(ossChipIds[i], "oss")}
                    className="text-xs bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-1.5 rounded-full hover:bg-sky-600 hover:text-white transition touch-manipulation min-h-[32px]"
                  >
                    {name.split("—")[0].trim()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight = false,
  muted = false,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-2 py-1.5 text-center ${
        highlight ? "bg-emerald-50 ring-1 ring-emerald-100" : muted ? "bg-slate-50" : "bg-slate-50/80"
      }`}
    >
      <p className="text-[9px] uppercase tracking-wide text-slate-400 truncate">{label}</p>
      <p
        className={`text-sm sm:text-base font-semibold tabular-nums leading-tight ${
          highlight ? "text-brand-dark" : muted ? "text-slate-400" : "text-slate-800"
        }`}
      >
        {value}
      </p>
      <p className="text-[9px] text-slate-400 leading-none mt-0.5 truncate">{sub}</p>
    </div>
  );
}
