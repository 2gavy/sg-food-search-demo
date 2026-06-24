import { useState } from "react";
import type { ColumnVariant } from "./CompareColumn";

interface Props {
  variant: ColumnVariant;
  mode: "text" | "photo";
  hybridOnlyCount?: number;
  bothCount?: number;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function RankingExplainer({ variant, mode, hybridOnlyCount = 0, bothCount = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const title = "How ranking works";

  const jinaText = mode === "photo" ? (
    <ul className="list-disc pl-4 space-y-1">
      <li>Matches your photo to venue embeddings via <strong>Elastic Inference</strong> (Jina v5 omni multimodal) — lexical cannot search images.</li>
      <li>Results rank by visual similarity within any geo filter you set.</li>
      <li>
        <span className="font-semibold text-brand-dark">New</span> venues appear only in hybrid columns; lexical returns none.
      </li>
    </ul>
  ) : (
    <ul className="list-disc pl-4 space-y-1">
      <li>
        <strong>RRF fusion</strong> merges keyword (BM25) with <strong>Elastic-hosted Jina v5 omni</strong> embeddings (1024-dim, multimodal).
      </li>
      <li>
        Scores like <span className="font-mono">0.03</span> are normal RRF rank contributions — order matters more than the number.
      </li>
      <li>
        <span className="font-semibold text-brand-dark">New</span> = Elastic Jina hybrid found it, lexical did not
        {hybridOnlyCount > 0 ? ` (${hybridOnlyCount})` : ""}. Compare with Elastic (E5) for contrast.
      </li>
    </ul>
  );

  const ossText = mode === "photo" ? (
    <ul className="list-disc pl-4 space-y-1">
      <li>Elastic E5 NLP library is text-only — gallery picks use the dish name as a text proxy, not true visual search.</li>
      <li>Raw photo uploads show unsupported; use Jina column for real multimodal matching.</li>
    </ul>
  ) : (
    <ul className="list-disc pl-4 space-y-1">
      <li>
        <strong>Elastic E5 library</strong> — built-in open-source <strong>multilingual-e5-small</strong> (384-dim, Apache 2.0 on HuggingFace).
      </li>
      <li>RRF fusion: BM25 keywords + E5 dense vectors — same pattern as Jina, smaller text-only baseline for SG multilingual queries.</li>
      <li>
        <span className="font-semibold text-sky-700">New</span> = Elastic E5 hybrid found it, lexical did not
        {hybridOnlyCount > 0 ? ` (${hybridOnlyCount})` : ""}.
      </li>
      <li>
        <span className="text-amber-600 font-medium">★ all</span> = venue appears in all three columns
        {bothCount > 0 ? ` (${bothCount})` : ""}.
      </li>
    </ul>
  );

  const lexicalText = mode === "photo" ? (
    <p>Lexical search matches exact words only — it cannot read photos, so this column stays empty.</p>
  ) : (
    <ul className="list-disc pl-4 space-y-1">
      <li>Keyword match on title, dish name, neighbourhood, and description (BM25-style).</li>
      <li>When location is set, results sort by distance after keyword score.</li>
      <li>Misses mood or vibe language unless those words appear in the venue text — compare with both hybrid columns.</li>
      {bothCount > 0 && (
        <li>
          <span className="text-amber-600 font-medium">★ all</span> marks venues all three columns returned ({bothCount}).
        </li>
      )}
    </ul>
  );

  const body =
    variant === "hybrid_jina" ? jinaText : variant === "hybrid_oss" ? ossText : lexicalText;

  return (
    <div className="mt-2 border-t border-slate-200/80 pt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 text-left text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ChevronIcon expanded={expanded} />
        <span className="font-medium">{title}</span>
      </button>
      {expanded && (
        <div className="mt-1.5 text-[11px] leading-relaxed text-slate-600 space-y-1">{body}</div>
      )}
    </div>
  );
}
