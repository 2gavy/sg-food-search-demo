import type { ReactNode } from "react";
import type { SearchSide } from "../types/venue";
import { RankingExplainer } from "./RankingExplainer";
import { CompareColumnSkeleton } from "./Skeleton";

export type ColumnVariant = "lexical" | "hybrid_oss" | "hybrid_jina";

interface Props {
  title: string;
  titleMobile?: string;
  subtitle: string;
  side: SearchSide | null;
  loading: boolean;
  variant: ColumnVariant;
  searchMode?: "text" | "photo";
  hybridOnlyCount?: number;
  bothCount?: number;
  emptyContent?: ReactNode;
  compactHeader?: boolean;
  children: ReactNode;
}

export function CompareColumn({
  title,
  titleMobile,
  subtitle,
  side,
  loading,
  variant,
  searchMode = "text",
  hybridOnlyCount,
  bothCount,
  emptyContent,
  compactHeader = false,
  children,
}: Props) {
  const headerBg =
    variant === "lexical" ? "bg-slate-100" : variant === "hybrid_oss" ? "bg-sky-50" : "bg-emerald-50";
  const labelColor =
    variant === "lexical" ? "text-slate-600" : variant === "hybrid_oss" ? "text-sky-700" : "text-brand-dark";

  return (
    <section className="flex flex-col h-full min-h-0 min-w-0 border border-slate-200 rounded-lg md:rounded-xl overflow-hidden bg-white shadow-sm">
      <header className={`shrink-0 px-2 md:px-3 py-2 md:py-2.5 border-b border-slate-200 ${headerBg}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] md:text-xs font-bold uppercase tracking-wide leading-tight ${labelColor}`}>
              <span className="md:hidden">{titleMobile ?? title}</span>
              <span className="hidden md:inline">{title}</span>
            </p>
            <p className="hidden lg:block text-xs text-slate-600 line-clamp-1 leading-snug mt-0.5">{subtitle}</p>
          </div>
          <p className="shrink-0 text-[10px] md:text-xs text-slate-500 tabular-nums">
            {loading ? "…" : side ? `${side.total} · ${side.took_ms}ms` : "—"}
          </p>
        </div>
        {!loading && !compactHeader && (
          <div className="hidden lg:block">
            <RankingExplainer
              variant={variant}
              mode={searchMode}
              hybridOnlyCount={hybridOnlyCount}
              bothCount={bothCount}
            />
          </div>
        )}
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-touch p-1.5 md:p-2.5 max-h-[52vh] lg:max-h-none lg:min-h-0">
        {loading && <CompareColumnSkeleton />}
        {!loading && side?.unsupported && (
          <div className="text-center py-4 px-2 md:px-4">
            {emptyContent}
            <p className="text-xs md:text-sm text-slate-500 mt-2 leading-snug">{side.message}</p>
          </div>
        )}
        {!loading && !side?.unsupported && side?.hits.length === 0 && (
          <p className="text-xs md:text-sm text-slate-400 text-center py-6">No matches</p>
        )}
        {!loading && !side?.unsupported && children}
      </div>
    </section>
  );
}
