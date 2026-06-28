import { useEffect, useState } from "react";
import { fetchVenueGraph } from "../lib/venueGraphCache";
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
    fetchVenueGraph(docId, { signal: controller.signal })
      .then((data) => setGraph(data))
      .catch(() => setGraph(null))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [docId, enabled]);

  return { graph, loading };
}
