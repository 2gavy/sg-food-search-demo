import { useCallback, useRef, useState } from "react";
import type { CompareResponse, DemoQuery } from "../types/venue";

export function useCompareSearch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [photoIsUpload, setPhotoIsUpload] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const abortInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const searchText = useCallback(
    async (
      query: string,
      geo?: { lat: number; lon: number; radius_m: number },
      filters?: { doc_types?: string[]; dietary_tags?: string[] },
    ) => {
      abortInFlight();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setPreviewImage(null);
      setPhotoIsUpload(false);
      try {
        const res = await fetch("/search/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            query,
            geo: geo ? { lat: geo.lat, lon: geo.lon, radius_m: geo.radius_m } : undefined,
            doc_types: filters?.doc_types,
            dietary_tags: filters?.dietary_tags,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        if (abortRef.current !== controller) return;
        setResult(await res.json());
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (abortRef.current !== controller) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [abortInFlight],
  );

  const searchPhoto = useCallback(
    async (
      dishId?: string,
      imageBase64?: string,
      geo?: { lat: number; lon: number; radius_m: number },
    ) => {
      abortInFlight();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      const isUpload = !dishId && !!imageBase64;
      setPhotoIsUpload(isUpload);
      if (dishId) setPreviewImage(`/assets/food/${dishId}.jpg`);
      else if (imageBase64) setPreviewImage(imageBase64);
      try {
        const res = await fetch("/search/compare-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ dish_id: dishId, image_base64: imageBase64, geo }),
        });
        if (!res.ok) throw new Error(await res.text());
        if (abortRef.current !== controller) return;
        setResult(await res.json());
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (abortRef.current !== controller) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [abortInFlight],
  );

  const runDemo = useCallback(
    (demo: DemoQuery) => {
      const geo =
        demo.lat != null && demo.lon != null
          ? { lat: demo.lat, lon: demo.lon, radius_m: demo.radius_m ?? 1500 }
          : undefined;
      if (demo.mode === "photo" && demo.dish_id) {
        searchPhoto(demo.dish_id, undefined, geo);
      } else if (demo.query) {
        searchText(demo.query, geo);
      }
    },
    [searchPhoto, searchText],
  );

  const resetSearch = useCallback(() => {
    abortInFlight();
    setLoading(false);
    setResult(null);
    setError(null);
    setPreviewImage(null);
    setPhotoIsUpload(false);
  }, [abortInFlight]);

  return { loading, result, error, previewImage, photoIsUpload, searchText, searchPhoto, runDemo, resetSearch, setResult };
}
