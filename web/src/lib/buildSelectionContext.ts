import type { CompareResponse, Hit, VenueGraphResponse } from "../types/venue";

export interface ColumnPlacement {
  rank: number;
  match_reason?: string;
  score?: number;
}

export interface SelectionContext {
  query: string;
  mode: "text" | "photo";
  selected: Hit;
  columns: {
    lexical: ColumnPlacement | null;
    hybrid_oss: ColumnPlacement | null;
    hybrid_jina: ColumnPlacement | null;
  };
  diff_tags: string[];
  /** Payload from GET /search/graph/{doc_id} — shared with map + Concierge */
  graph?: VenueGraphResponse | null;
}

function placementFromSide(hits: Hit[], docId: string): ColumnPlacement | null {
  const idx = hits.findIndex((h) => h.doc_id === docId);
  if (idx < 0) return null;
  const hit = hits[idx];
  return {
    rank: idx + 1,
    match_reason: hit.match_reason,
    score: hit.score,
  };
}

export function buildSelectionContext(
  selected: Hit,
  result: CompareResponse | null,
  query: string,
  mode: "text" | "photo",
  graph?: VenueGraphResponse | null,
): SelectionContext | null {
  if (!result) return null;

  const docId = selected.doc_id;
  const diff_tags: string[] = [];
  if (result.diff.all_three.includes(docId)) diff_tags.push("in_all_three_columns");
  if (result.diff.hybrid_only_jina.includes(docId)) diff_tags.push("jina_only_vs_keywords");
  if (result.diff.hybrid_only_oss.includes(docId)) diff_tags.push("e5_only_vs_keywords");
  if (result.diff.lexical_only.includes(docId)) diff_tags.push("keywords_only");

  return {
    query: result.query || query,
    mode: result.mode || mode,
    selected,
    columns: {
      lexical: placementFromSide(result.lexical.hits, docId),
      hybrid_oss: placementFromSide(result.hybrid_oss.hits, docId),
      hybrid_jina: placementFromSide(result.hybrid_jina.hits, docId),
    },
    diff_tags,
    graph: graph ?? null,
  };
}
