import { DishImage } from "./DishImage";
import { DiscoverGridSkeleton } from "./Skeleton";
import type { DiscoverCluster, Hit } from "../types/venue";

interface Props {
  loading: boolean;
  error: string | null;
  summary?: string;
  clusters: DiscoverCluster[];
  onSearchTheme: (query: string, discoverLabel?: string) => void;
  onSelectVenue: (hit: Hit) => void;
  onRefresh: () => void;
}

export function DiscoverPanel({
  loading,
  error,
  summary,
  clusters,
  onSearchTheme,
  onSelectVenue,
  onRefresh,
}: Props) {
  if (loading && clusters.length === 0) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Food scenes in the corpus</h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Grouping stalls by Jina clustering embeddings…
          </p>
        </div>
        <DiscoverGridSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        <button type="button" onClick={onRefresh} className="ml-2 underline">
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Food scenes in the corpus</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
          Stalls grouped by Jina clustering embeddings — same hawker centre, neighbourhood, or dish vibe.
          Labels use real venue fields (dish, area, hawker centre), not search queries.
        </p>
        {summary && (
          <p className="mt-2 text-xs text-slate-500">{summary}</p>
        )}
      </div>

      {clusters.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No scenes found. Run <code className="text-xs bg-white px-1 rounded">./scripts/prep-demo.sh</code> if embeddings are missing.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clusters.map((cluster) => (
            <article
              key={cluster.cluster_id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col hover:border-slate-300 transition"
            >
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 leading-snug">{cluster.label}</h3>
                {cluster.subtitle && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{cluster.subtitle}</p>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{cluster.size} stalls in this scene</p>

              {cluster.terms.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {cluster.terms.slice(0, 5).map((t) => (
                    <span
                      key={t.term}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600"
                    >
                      {t.term}
                    </span>
                  ))}
                </div>
              )}

              <ul className="mt-3 space-y-2 flex-1">
                {cluster.sample_hits.map((hit) => (
                  <li key={hit.doc_id}>
                    <button
                      type="button"
                      onClick={() => onSelectVenue(hit)}
                      className="w-full text-left flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5 hover:border-slate-200 hover:bg-white transition"
                    >
                      <DishImage
                        dishId={hit.dish_id ?? "chicken_rice"}
                        label={hit.signature_dish ?? hit.title}
                        className="w-9 h-9 rounded-md shrink-0 object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-slate-800 truncate">{hit.title}</span>
                        <span className="block text-[10px] text-slate-500 truncate">
                          {[hit.hawker_centre, hit.neighbourhood].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onSearchTheme(cluster.search_query || cluster.label.replace(/ · /g, " "), cluster.label)}
                className="mt-3 w-full text-xs font-medium py-2 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              >
                Search this scene
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
