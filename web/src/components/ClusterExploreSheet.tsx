import { useEffect, useState } from "react";
import { DishImage } from "./DishImage";
import type { DiscoverCluster, DiscoverClusterExploreResponse, Hit } from "../types/venue";

interface Props {
  cluster: DiscoverCluster | null;
  onClose: () => void;
  onSelectVenue: (hit: Hit) => void;
}

export function ClusterExploreSheet({ cluster, onClose, onSelectVenue }: Props) {
  const [data, setData] = useState<DiscoverClusterExploreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cluster) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/discover/clusters/${encodeURIComponent(cluster.cluster_id)}/explore?size=10`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [cluster]);

  if (!cluster) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                Diversify retriever
              </p>
              <h3 className="font-semibold text-slate-900 leading-snug">{cluster.label}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                MMR breadth across {cluster.size} venues — not just the centroid
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 px-2" aria-label="Close">
              ✕
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {data && (
            <p className="text-[11px] text-slate-500 mb-2">
              {data.note}
              {data.method === "diversify" ? " · MMR" : ""}
            </p>
          )}
          {data?.hits
            .filter((hit, i, arr) => {
              const key = `${hit.title}|${hit.neighbourhood ?? ""}`;
              return arr.findIndex((h) => `${h.title}|${h.neighbourhood ?? ""}` === key) === i;
            })
            .map((hit) => (
            <button
              key={hit.doc_id}
              type="button"
              onClick={() => onSelectVenue(hit)}
              className="w-full text-left flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-2 hover:border-slate-200 hover:bg-white"
            >
              <DishImage
                dishId={hit.dish_id ?? "chicken_rice"}
                label={hit.signature_dish ?? hit.title}
                className="w-10 h-10 rounded-md shrink-0 object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800 truncate">{hit.title}</span>
                <span className="block text-[10px] text-slate-500 truncate">
                  {[hit.hawker_centre, hit.neighbourhood].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
