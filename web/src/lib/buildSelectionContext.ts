import type { CompareResponse, DiscoverCluster, Hit, VenueGraphResponse } from "../types/venue";

export interface ColumnPlacement {
  rank: number;
  match_reason?: string;
  score?: number;
}

export interface DiscoverPreview {
  label: string;
  size: number;
  search_query: string;
  subtitle?: string | null;
}

export interface AgentContext {
  context_type: "compare" | "browse";
  query: string;
  mode: "text" | "photo";
  app_view?: "search" | "discover";
  selected?: Hit | null;
  columns?: {
    lexical: ColumnPlacement | null;
    hybrid_oss: ColumnPlacement | null;
    hybrid_jina: ColumnPlacement | null;
  };
  diff_tags?: string[];
  diff_summary: {
    hybrid_only_jina: string[];
    hybrid_only_oss: string[];
    all_three: string[];
    lexical_only: string[];
  };
  top_hits: {
    lexical: Hit[];
    hybrid_oss: Hit[];
    hybrid_jina: Hit[];
  };
  discover_preview?: DiscoverPreview[];
  graph?: VenueGraphResponse | null;
}

/** @deprecated use AgentContext */
export type SelectionContext = AgentContext;

const EMPTY_DIFF = {
  hybrid_only_jina: [] as string[],
  hybrid_only_oss: [] as string[],
  all_three: [] as string[],
  lexical_only: [] as string[],
};

const EMPTY_HITS = {
  lexical: [] as Hit[],
  hybrid_oss: [] as Hit[],
  hybrid_jina: [] as Hit[],
};

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

function topSlice(hits: Hit[], n = 5): Hit[] {
  return hits.slice(0, n).map((h, i) => ({ ...h, rank: i + 1 }));
}

export function buildAgentContext(
  result: CompareResponse | null,
  query: string,
  mode: "text" | "photo",
  selected?: Hit | null,
  graph?: VenueGraphResponse | null,
  opts?: {
    appView?: "search" | "discover";
    discoverClusters?: DiscoverCluster[];
  },
): AgentContext {
  if (result) {
    const base: AgentContext = {
      context_type: "compare",
      query: result.query || query,
      mode: result.mode || mode,
      app_view: opts?.appView,
      diff_summary: {
        hybrid_only_jina: result.diff.hybrid_only_jina,
        hybrid_only_oss: result.diff.hybrid_only_oss,
        all_three: result.diff.all_three,
        lexical_only: result.diff.lexical_only,
      },
      top_hits: {
        lexical: topSlice(result.lexical.hits),
        hybrid_oss: topSlice(result.hybrid_oss.hits),
        hybrid_jina: topSlice(result.hybrid_jina.hits),
      },
      graph: graph ?? null,
    };

    if (!selected) return base;

    const docId = selected.doc_id;
    const diff_tags: string[] = [];
    if (result.diff.all_three.includes(docId)) diff_tags.push("in_all_three_columns");
    if (result.diff.hybrid_only_jina.includes(docId)) diff_tags.push("jina_only_vs_keywords");
    if (result.diff.hybrid_only_oss.includes(docId)) diff_tags.push("e5_only_vs_keywords");
    if (result.diff.lexical_only.includes(docId)) diff_tags.push("keywords_only");

    return {
      ...base,
      selected,
      columns: {
        lexical: placementFromSide(result.lexical.hits, docId),
        hybrid_oss: placementFromSide(result.hybrid_oss.hits, docId),
        hybrid_jina: placementFromSide(result.hybrid_jina.hits, docId),
      },
      diff_tags,
    };
  }

  return {
    context_type: "browse",
    query: query.trim(),
    mode,
    app_view: opts?.appView,
    selected: selected ?? null,
    diff_summary: { ...EMPTY_DIFF },
    top_hits: { ...EMPTY_HITS },
    discover_preview: (opts?.discoverClusters ?? []).slice(0, 6).map((c) => ({
      label: c.label,
      size: c.size,
      search_query: c.search_query ?? "",
      subtitle: c.subtitle,
    })),
    graph: graph ?? null,
  };
}

export const buildSelectionContext = buildAgentContext;
