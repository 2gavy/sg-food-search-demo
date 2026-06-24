import { useEffect, useState } from "react";
import type { VenueGraphResponse } from "../types/venue";

export function useVenueGraph(docId: string | null | undefined, enabled = true) {
  const [graph, setGraph] = useState<VenueGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docId || !enabled) {
      setGraph(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetch(`/search/graph/${encodeURIComponent(docId)}?hops=2&limit=2`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: VenueGraphResponse | null) => setGraph(data))
      .catch(() => setGraph(null))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [docId, enabled]);

  return { graph, loading };
}
