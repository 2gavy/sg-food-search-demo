import type { CompareResponse } from "../types/venue";

interface Props {
  result: CompareResponse | null;
}

export function RelevanceProofStrip({ result }: Props) {
  if (!result) return null;

  const lexN = result.lexical.hits.length;
  const ossN = result.hybrid_oss.hits.length;
  const jinaN = result.hybrid_jina.hits.length;
  const jinaOnly = result.diff.hybrid_only_jina.length;
  const ossOnly = result.diff.hybrid_only_oss.length;
  const allThree = result.diff.all_three.length;

  let headline: string;
  let detail: string;
  let accent: "emerald" | "violet" | "slate" = "emerald";

  if (result.mode === "photo") {
    accent = "violet";
    if (result.lexical.unsupported || lexN === 0) {
      headline = "Multimodal proof";
      detail = "Lexical can’t search photos. Jina matched venues by visual similarity in the same index.";
    } else {
      headline = "Multimodal compare";
      detail = "E5 uses the dish name as text; Jina uses true image embeddings.";
    }
  } else if (lexN === 0 && (ossN > 0 || jinaN > 0)) {
    accent = "violet";
    headline = "Multilingual proof";
    detail = `Keywords: 0 results. Hybrid: ${Math.max(ossN, jinaN)} — intent matched across languages.`;
  } else if (jinaOnly > 0 || ossOnly > 0) {
    accent = "emerald";
    headline = "Semantic proof";
    detail = `Hybrid found ${jinaOnly + ossOnly} venue${jinaOnly + ossOnly === 1 ? "" : "s"} keywords missed — same index, different understanding.`;
  } else if (allThree > 0 && jinaOnly === 0 && ossOnly === 0) {
    accent = "slate";
    headline = "All three agree";
    detail = `${allThree} venue${allThree === 1 ? "" : "s"} ranked by keyword and both hybrid models.`;
  } else {
    accent = "slate";
    headline = "Compare the columns";
    detail = "When hybrid surfaces venues lexical misses, that gap is your relevance proof.";
  }

  const accentBorder =
    accent === "violet" ? "border-l-violet-500" : accent === "slate" ? "border-l-slate-400" : "border-l-brand";

  return (
    <div className={`rounded-lg border border-slate-200 bg-white border-l-4 ${accentBorder} px-3 py-2.5 sm:px-4 shadow-sm`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{headline}</p>
          <p className="text-xs sm:text-sm text-slate-600 leading-snug mt-0.5">{detail}</p>
        </div>
        <div className="flex shrink-0 gap-1.5 text-[11px] font-medium tabular-nums">
          <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-1">Lex {lexN}</span>
          <span className="rounded-full bg-sky-50 text-sky-700 px-2.5 py-1">E5 {ossN}</span>
          <span className="rounded-full bg-emerald-50 text-brand-dark px-2.5 py-1">Jina {jinaN}</span>
        </div>
      </div>
    </div>
  );
}
