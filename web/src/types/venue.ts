export interface Hit {
  doc_id: string;
  title: string;
  doc_type: string;
  venue_tier?: string;
  description?: string;
  signature_dish?: string;
  dish_id?: string;
  hawker_centre?: string;
  neighbourhood?: string;
  location?: { lat: number; lon: number };
  hero_image_url?: string;
  rating?: number;
  price_range?: string;
  distance_metres?: number;
  match_reason?: string;
  score?: number;
  rank?: number;
}

export type GraphEdgeType = "same_dish" | "same_hawker" | "semantic_similar" | "graph_explore";

export interface GraphEdge {
  source_id: string;
  target_id: string;
  edge_type: GraphEdgeType;
  label: string;
  es_pattern: string;
  hop: number;
}

export interface VenueGraphResponse {
  center_id: string;
  edges: GraphEdge[];
  nodes: Hit[];
  took_ms: number;
  summary: string;
  engine?: "explore" | "structural";
  es_api?: string;
}

export interface SearchSide {
  hits: Hit[];
  total: number;
  took_ms: number;
  unsupported?: boolean;
  message?: string;
}

export interface CompareDiff {
  hybrid_only_jina: string[];
  hybrid_only_oss: string[];
  lexical_only: string[];
  all_three: string[];
  jina_only: string[];
  oss_only: string[];
  /** @deprecated use hybrid_only_jina */
  hybrid_only?: string[];
  /** @deprecated use all_three */
  both?: string[];
}

export interface CompareResponse {
  query: string;
  mode: "text" | "photo";
  lexical: SearchSide;
  hybrid_oss: SearchSide;
  hybrid_jina: SearchSide;
  diff: CompareDiff;
  /** @deprecated use hybrid_jina */
  hybrid?: SearchSide;
}

export interface DemoQuery {
  id: string;
  label: string;
  query?: string;
  dish_id?: string;
  mode: "text" | "photo";
  lat?: number;
  lon?: number;
  radius_m?: number;
  /** UI grouping — e.g. multilingual proof prompts */
  group?: "default" | "multilingual";
  /** Short language tag shown on multilingual prompts */
  lang_label?: string;
}
