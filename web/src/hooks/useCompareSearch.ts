import { useCallback, useState } from "react";
import type { CompareResponse, DemoQuery } from "../types/venue";

export function useCompareSearch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [photoIsUpload, setPhotoIsUpload] = useState(false);

  const searchText = useCallback(
    async (query: string, geo?: { lat: number; lon: number; radius_m: number }, filters?: { doc_types?: string[]; dietary_tags?: string[] }) => {
      setLoading(true);
      setError(null);
      setPreviewImage(null);
      setPhotoIsUpload(false);
      try {
        const res = await fetch("/search/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, geo: geo ? { lat: geo.lat, lon: geo.lon, radius_m: geo.radius_m } : undefined, ...filters }),
        });
        if (!res.ok) throw new Error(await res.text());
        setResult(await res.json());
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const searchPhoto = useCallback(async (dishId?: string, imageBase64?: string, geo?: { lat: number; lon: number; radius_m: number }) => {
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
        body: JSON.stringify({ dish_id: dishId, image_base64: imageBase64, geo }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const runDemo = useCallback(
    (demo: DemoQuery) => {
      if (demo.mode === "photo" && demo.dish_id) {
        searchPhoto(demo.dish_id, undefined, demo.lat && demo.lon ? { lat: demo.lat, lon: demo.lon, radius_m: demo.radius_m ?? 1500 } : undefined);
      } else if (demo.query) {
        searchText(
          demo.query,
          demo.lat && demo.lon ? { lat: demo.lat, lon: demo.lon, radius_m: demo.radius_m ?? 1500 } : undefined,
        );
      }
    },
    [searchPhoto, searchText],
  );

  const resetSearch = useCallback(() => {
    setLoading(false);
    setResult(null);
    setError(null);
    setPreviewImage(null);
    setPhotoIsUpload(false);
  }, []);

  return { loading, result, error, previewImage, photoIsUpload, searchText, searchPhoto, runDemo, resetSearch, setResult };
}
