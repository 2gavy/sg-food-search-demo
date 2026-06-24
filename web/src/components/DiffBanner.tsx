import type { CompareResponse, Hit } from "../types/venue";

interface Props {
  result: CompareResponse | null;
  onSelectHit?: (docId: string, column: "oss" | "jina") => void;
}

export function DiffBanner({ result, onSelectHit }: Props) {
  if (!result) return null;

  const isPhoto = result.mode === "photo";
  const keywordBaseline = !result.lexical.unsupported;

  const jinaExtra = result.diff.hybrid_only_jina.length;
  const ossExtra = result.diff.hybrid_only_oss.length;
  const jinaOnlyVsE5 = result.diff.jina_only.length;
  const ossOnlyVsE5 = result.diff.oss_only.length;
  const allThree = result.diff.all_three.length;

  const showKeywordDiff = keywordBaseline && (jinaExtra > 0 || ossExtra > 0);
  const showHybridDiff = jinaOnlyVsE5 > 0 || ossOnlyVsE5 > 0;

  if (!showKeywordDiff && !showHybridDiff) {
    return (
      <p className="text-center text-xs sm:text-sm text-slate-500 py-2.5 rounded-lg border border-slate-200 bg-slate-50/90">
        {isPhoto
          ? "Jina and E5 returned the same venues for this photo."
          : "All three columns returned the same venues for this query."}
      </p>
    );
  }

  const jinaChipIds = keywordBaseline
    ? result.diff.hybrid_only_jina
    : result.diff.jina_only;
  const ossChipIds = keywordBaseline
    ? result.diff.hybrid_only_oss
    : result.diff.oss_only;

  const jinaNames = result.hybrid_jina.hits
    .filter((h) => jinaChipIds.includes(h.doc_id))
    .map((h) => h.title);
  const ossNames = result.hybrid_oss.hits
    .filter((h) => ossChipIds.includes(h.doc_id))
    .map((h) => h.title);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 sm:px-4">
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
      {(jinaNames.length > 0 || ossNames.length > 0) && (
        <div className="flex flex-wrap justify-center gap-1.5 mt-2 pt-2 border-t border-slate-200/80">
          {jinaNames.slice(0, 3).map((name, i) => (
            <button
              key={`jina-${name}`}
              type="button"
              onClick={() => onSelectHit?.(jinaChipIds[i], "jina")}
              className="text-xs bg-emerald-50 text-brand-dark border border-brand/25 px-2.5 py-1.5 rounded-full hover:bg-brand hover:text-white transition touch-manipulation min-h-[32px]"
            >
              {name.split("—")[0].trim()}
            </button>
          ))}
          {ossNames.slice(0, 3).map((name, i) => (
            <button
              key={`oss-${name}`}
              type="button"
              onClick={() => onSelectHit?.(ossChipIds[i], "oss")}
              className="text-xs bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-1.5 rounded-full hover:bg-sky-600 hover:text-white transition touch-manipulation min-h-[32px]"
            >
              {name.split("—")[0].trim()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type { Hit };
