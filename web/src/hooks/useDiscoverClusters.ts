import { useEffect, useState } from "react";
import type { DiscoverClustersResponse } from "../types/venue";

export function useDiscoverClusters(enabled = true) {
  const [data, setData] = useState<DiscoverClustersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = (refresh = false) => {
    setLoading(true);
    setError(null);
    const q = refresh ? "?refresh=true" : "";
    fetch(`/discover/clusters${q}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load clusters"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!enabled) return;
    load(false);
  }, [enabled]);

  return { data, loading, error, reload: () => load(true) };
}
