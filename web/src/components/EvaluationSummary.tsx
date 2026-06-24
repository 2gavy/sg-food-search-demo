import type { CompareResponse } from "../types/venue";

interface Props {
  result: CompareResponse | null;
}

function formatExtra(count: number): string {
  return count > 0 ? `+${count}` : "0";
}

export function EvaluationSummary({ result }: Props) {
  if (!result) return null;

  const lex = result.lexical;
  const oss = result.hybrid_oss;
  const jina = result.hybrid_jina;
  const lexN = lex.hits.length;
  const ossN = oss.hits.length;
  const jinaN = jina.hits.length;
  const jinaExtra = result.diff.hybrid_only_jina.length;
  const ossExtra = result.diff.hybrid_only_oss.length;
  const uniqueExtra = new Set([...result.diff.hybrid_only_jina, ...result.diff.hybrid_only_oss]).size;
  const totalMs = lex.took_ms + oss.took_ms + jina.took_ms;

  let note: string;
  if (lexN === 0 && (ossN > 0 || jinaN > 0)) {
    note = "Hybrid search matched intent where keywords returned nothing.";
  } else if (uniqueExtra > 0) {
    note = `${uniqueExtra} venue${uniqueExtra === 1 ? "" : "s"} in hybrid top 10 not shown in keyword top 10.`;
  } else {
    note = "Same venues in all three columns — try mood or multilingual prompts to see extra recall.";
  }

  const metrics = (
    <>
      <Metric label="Keywords" value={String(lexN)} sub="BM25" compact />
      <Metric
        label="E5 extra"
        value={oss.unsupported ? "N/A" : formatExtra(ossExtra)}
        sub="vs BM25"
        highlight={!oss.unsupported && ossExtra > 0}
        muted={oss.unsupported}
        compact
      />
      <Metric
        label="Jina extra"
        value={formatExtra(jinaExtra)}
        sub="vs BM25"
        highlight={jinaExtra > 0}
        compact
      />
      <Metric label="Latency" value={`${totalMs}ms`} sub="total" compact />
    </>
  );

  const queryLabel = result.query;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-3 sm:px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Query results</p>
            <span className="hidden sm:inline text-slate-300">·</span>
            <div className="hidden sm:flex flex-wrap gap-1">
              {["One index", "RRF hybrid", "Serverless"].map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] text-slate-400 bg-slate-50 border border-slate-200/80 rounded-full px-1.5 py-px"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-1 text-sm sm:text-base font-semibold text-slate-900 leading-snug break-words line-clamp-2">
            {queryLabel}
          </p>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">{note}</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:w-[min(100%,420px)] lg:shrink-0">
          {metrics}
        </div>
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
  compact = false,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
  muted?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-2 py-1.5 text-center ${
        highlight ? "bg-emerald-50 ring-1 ring-emerald-100" : muted ? "bg-slate-50" : "bg-slate-50/80"
      }`}
    >
      <p className={`text-[9px] uppercase tracking-wide text-slate-400 ${compact ? "truncate" : ""}`}>{label}</p>
      <p
        className={`${compact ? "text-sm sm:text-base" : "text-base sm:text-lg"} font-semibold tabular-nums leading-tight ${
          highlight ? "text-brand-dark" : muted ? "text-slate-400" : "text-slate-800"
        }`}
      >
        {value}
      </p>
      <p className="text-[9px] text-slate-400 leading-none mt-0.5 truncate">{sub}</p>
    </div>
  );
}
