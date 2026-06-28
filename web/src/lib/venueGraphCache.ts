import type { VenueGraphResponse } from "../types/venue";

const inflight = new Map<string, Promise<VenueGraphResponse | null>>();

export function fetchVenueGraph(
  docId: string,
  opts?: { hops?: number; limit?: number; signal?: AbortSignal },
): Promise<VenueGraphResponse | null> {
  const hops = opts?.hops ?? 2;
  const limit = opts?.limit ?? 2;
  const key = `${docId}:${hops}:${limit}`;

  if (!inflight.has(key)) {
    const url = `/search/graph/${encodeURIComponent(docId)}?hops=${hops}&limit=${limit}`;
    const promise = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, promise);
  }

  const base = inflight.get(key)!;
  if (!opts?.signal) return base;

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    if (opts.signal!.aborted) {
      onAbort();
      return;
    }
    opts.signal!.addEventListener("abort", onAbort, { once: true });
    base
      .then((data) => {
        opts.signal!.removeEventListener("abort", onAbort);
        resolve(data);
      })
      .catch((err) => {
        opts.signal!.removeEventListener("abort", onAbort);
        reject(err);
      });
  });
}

export function clearVenueGraphCache() {
  inflight.clear();
}
