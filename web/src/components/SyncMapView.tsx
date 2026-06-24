import { MapContainer, TileLayer, Circle, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CompareResponse, GraphEdge, GraphEdgeType, Hit, VenueGraphResponse } from "../types/venue";
import { formatBuyerMatchReason } from "../lib/matchReason";
import { resolveVenueImageUrl } from "../lib/venueImage";

const pinIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const selectedPinIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [32, 52],
  iconAnchor: [16, 52],
});

const graphPeerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [22, 36],
  iconAnchor: [11, 36],
});

const EDGE_STYLE: Record<GraphEdgeType, { color: string; dashArray?: string }> = {
  same_dish: { color: "#d97706" },
  same_hawker: { color: "#0284c7" },
  semantic_similar: { color: "#7c3aed", dashArray: "6 4" },
  graph_explore: { color: "#059669", dashArray: "4 3" },
};

const GRAPH_FIT_MAX_ZOOM = 14;
const GRAPH_FIT_MAX_ZOOM_TIGHT = 13;
const GRAPH_CLUSTER_SPAN_M = 220;
const COLOCATED_SPREAD_M = 48;

function spreadPosition(lat: number, lon: number, index: number, total: number, radiusM = COLOCATED_SPREAD_M): [number, number] {
  if (total <= 1) return [lat, lon];
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  const dLat = (radiusM * Math.cos(angle)) / 111_320;
  const dLon = (radiusM * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lon + dLon];
}

function maxSpanMeters(points: [number, number][]): number {
  if (points.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(max, L.latLng(points[i]).distanceTo(L.latLng(points[j])));
    }
  }
  return max;
}

function colocatedGroupKey(id: string, loc: { lat: number; lon: number }, meta?: { hawker_centre?: string }): string {
  if (meta?.hawker_centre) return `hawker:${meta.hawker_centre}`;
  return `geo:${loc.lat.toFixed(4)},${loc.lon.toFixed(4)}:${id}`;
}

function buildDisplayPositions(
  raw: Map<string, { lat: number; lon: number }>,
  metaById: Map<string, { hawker_centre?: string }>,
): Map<string, { lat: number; lon: number }> {
  const groups = new Map<string, string[]>();
  for (const [id, loc] of raw) {
    const key = colocatedGroupKey(id, loc, metaById.get(id));
    const list = groups.get(key) ?? [];
    list.push(id);
    groups.set(key, list);
  }

  const out = new Map(raw);
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    ids.sort();
    const centerLat = ids.reduce((sum, id) => sum + raw.get(id)!.lat, 0) / ids.length;
    const centerLon = ids.reduce((sum, id) => sum + raw.get(id)!.lon, 0) / ids.length;
    ids.forEach((id, i) => {
      const [lat, lon] = spreadPosition(centerLat, centerLon, i, ids.length);
      out.set(id, { lat, lon });
    });
  }
  return out;
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)}m away`;
  return `${(metres / 1000).toFixed(1)}km away`;
}

function venueInitials(title: string): string {
  const parts = title.split(/[\s—–-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return title.slice(0, 2).toUpperCase();
}

function collectMapHits(result: CompareResponse | null): Hit[] {
  if (!result) return [];
  const byId = new Map<string, Hit>();
  for (const hit of result.lexical.hits) {
    if (hit.location) byId.set(hit.doc_id, hit);
  }
  for (const hit of result.hybrid_oss.hits) {
    if (hit.location) byId.set(hit.doc_id, hit);
  }
  for (const hit of result.hybrid_jina.hits) {
    if (hit.location) byId.set(hit.doc_id, hit);
  }
  return Array.from(byId.values());
}

function hitInColumn(result: CompareResponse | null, docId: string, column: "lexical" | "oss" | "jina"): boolean {
  if (!result) return false;
  const hits =
    column === "lexical"
      ? result.lexical.hits
      : column === "oss"
        ? result.hybrid_oss.hits
        : result.hybrid_jina.hits;
  return hits.some((h) => h.doc_id === docId);
}

function MapViewController({
  expanded,
  fitPoints,
  rawFitSpanM,
  graphFitKey,
  graphActive,
  selectedHit,
}: {
  expanded: boolean;
  fitPoints: [number, number][];
  rawFitSpanM: number;
  graphFitKey: string;
  graphActive: boolean;
  selectedHit: Hit | null;
}) {
  const map = useMap();
  const lastFitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const container = map.getContainer();
    const syncSize = () => map.invalidateSize({ animate: false });
    const ro = new ResizeObserver(() => syncSize());
    ro.observe(container);
    syncSize();
    return () => ro.disconnect();
  }, [map]);

  useEffect(() => {
    const syncSize = () => map.invalidateSize({ animate: false });
    syncSize();
    const t1 = window.setTimeout(syncSize, 80);
    const t2 = window.setTimeout(syncSize, 240);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [expanded, map]);

  // Pan to selected pin on every selection (keeps card + pin aligned, no full refit).
  useEffect(() => {
    if (!selectedHit?.location) return;
    map.panTo([selectedHit.location.lat, selectedHit.location.lon], { animate: true, duration: 0.45 });
  }, [selectedHit?.doc_id, map]);

  // Fit full graph once per load / expand — not on every re-render.
  useEffect(() => {
    if (!graphActive || fitPoints.length === 0) return;
    const fitKey = `${graphFitKey}:${expanded}`;
    if (lastFitKeyRef.current === fitKey) return;
    lastFitKeyRef.current = fitKey;
    const t = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
      const padding: [number, number] = expanded ? [96, 96] : [64, 64];
      const tight = rawFitSpanM > 0 && rawFitSpanM < GRAPH_CLUSTER_SPAN_M;
      const maxZoom = tight ? GRAPH_FIT_MAX_ZOOM_TIGHT : GRAPH_FIT_MAX_ZOOM;
      if (fitPoints.length === 1) {
        map.setView(fitPoints[0], maxZoom, { animate: true });
        return;
      }
      map.fitBounds(L.latLngBounds(fitPoints), {
        padding,
        maxZoom,
        animate: true,
      });
    }, expanded ? 120 : 40);
    return () => window.clearTimeout(t);
  }, [graphFitKey, graphActive, fitPoints, rawFitSpanM, expanded, map]);

  return null;
}

function relationToCenter(center: Hit | null, hit: Hit): { type: GraphEdgeType | "center"; label: string } | null {
  if (!center || center.doc_id === hit.doc_id) return { type: "center", label: "Selected pin" };
  if (center.dish_id && hit.dish_id === center.dish_id) {
    return { type: "same_dish", label: `Same dish · ${hit.signature_dish ?? center.signature_dish ?? "shared dish"}` };
  }
  if (center.hawker_centre && hit.hawker_centre === center.hawker_centre) {
    return { type: "same_hawker", label: `Same hawker · ${hit.hawker_centre}` };
  }
  return null;
}

function MapMarker({
  hit,
  position,
  icon,
  zIndexOffset,
  isOpen,
  onSelect,
  children,
}: {
  hit: Hit;
  position: { lat: number; lon: number };
  icon: L.Icon;
  zIndexOffset?: number;
  isOpen: boolean;
  onSelect: (hit: Hit) => void;
  children: ReactNode;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (isOpen) marker.openPopup();
    else marker.closePopup();
  }, [isOpen, hit.doc_id]);

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lon]}
      icon={icon}
      zIndexOffset={zIndexOffset ?? 0}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          onSelect(hit);
        },
      }}
    >
      <Popup autoClose={false} closeOnClick={false} autoPan={false} minWidth={260} maxWidth={300}>
        {children}
      </Popup>
    </Marker>
  );
}

function ColumnTag({ label, tone }: { label: string; tone: "slate" | "sky" | "brand" | "amber" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 border-slate-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    brand: "bg-emerald-50 text-brand-dark border-brand/25",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tones[tone]}`}>{label}</span>
  );
}

function GraphBadge({ edgeType, label }: { edgeType: GraphEdgeType | "center"; label: string }) {
  const styles: Record<GraphEdgeType | "center", string> = {
    same_dish: "bg-amber-50 text-amber-900 border-amber-200",
    same_hawker: "bg-sky-50 text-sky-900 border-sky-200",
    semantic_similar: "bg-violet-50 text-violet-900 border-violet-200",
    graph_explore: "bg-emerald-50 text-emerald-900 border-emerald-200",
    center: "bg-emerald-50 text-emerald-900 border-emerald-200",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles[edgeType]}`}>{label}</span>
  );
}

function VenuePopup({
  hit,
  result,
  graphEdges,
  centerHit,
  compact = false,
}: {
  hit: Hit;
  result: CompareResponse | null;
  graphEdges?: GraphEdge[];
  centerHit?: Hit | null;
  compact?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = resolveVenueImageUrl(hit);
  const matchLine = formatBuyerMatchReason(hit, false);
  const docTypeLabel = hit.doc_type?.replace(/_/g, " ") ?? "venue";

  const inLex = hitInColumn(result, hit.doc_id, "lexical");
  const inOss = hitInColumn(result, hit.doc_id, "oss");
  const inJina = hitInColumn(result, hit.doc_id, "jina");
  const newOss = result?.diff.hybrid_only_oss.includes(hit.doc_id) ?? false;
  const newJina = result?.diff.hybrid_only_jina.includes(hit.doc_id) ?? false;
  const inAllThree = result?.diff.all_three.includes(hit.doc_id) ?? false;

  const shortTitle = hit.title.split("—")[0].trim();
  const relation = centerHit ? relationToCenter(centerHit, hit) : null;

  return (
    <div className={compact ? "map-venue-popup" : "map-venue-popup w-[260px] sm:w-[280px]"}>
      <div className="flex gap-2.5">
        {imageUrl && !imgFailed ? (
          <img
            src={imageUrl}
            alt=""
            className="w-14 h-14 rounded-md object-cover bg-slate-100 shrink-0"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="w-14 h-14 rounded-md shrink-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-300 text-slate-700 text-sm font-bold"
            aria-hidden
          >
            {venueInitials(hit.title)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-snug">{shortTitle}</p>
          {hit.hawker_centre && (
            <p className="text-[11px] text-sky-800 font-medium mt-0.5 leading-snug">{hit.hawker_centre}</p>
          )}
          <p className="text-[11px] text-slate-500 mt-0.5 capitalize leading-snug">
            {docTypeLabel}
            {hit.neighbourhood ? ` · ${hit.neighbourhood}` : hit.venue_tier ? ` · ${hit.venue_tier.replace(/_/g, " ")}` : ""}
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            ★ {hit.rating ?? "—"}
            {hit.price_range ? ` · ${hit.price_range}` : ""}
            {hit.distance_metres != null ? ` · ${formatDistance(hit.distance_metres)}` : ""}
          </p>
        </div>
      </div>

      {hit.signature_dish && (
        <p className="text-xs text-slate-800 mt-2 leading-snug">
          <span className="text-slate-400">Signature · </span>
          <span className="font-medium">{hit.signature_dish}</span>
          {hit.dish_id && centerHit?.dish_id === hit.dish_id && centerHit.doc_id !== hit.doc_id && (
            <span className="ml-1 text-amber-700">(same dish as selected)</span>
          )}
        </p>
      )}

      {relation?.type === "center" && (
        <div className="mt-2">
          <GraphBadge edgeType="center" label="Selected · graph centre" />
        </div>
      )}

      {relation && relation.type !== "center" && (
        <div className="mt-2">
          <GraphBadge edgeType={relation.type} label={relation.label} />
        </div>
      )}

      {graphEdges && graphEdges.length > 0 && !compact && (
        <div className="mt-2 space-y-1">
          {graphEdges.map((edge) => (
            <p
              key={`${edge.hop}-${edge.source_id}-${edge.edge_type}`}
              className="text-[10px] text-violet-800 bg-violet-50 border border-violet-100 rounded px-1.5 py-1 leading-snug"
            >
              Hop {edge.hop} · {edge.label}
              <span className="block text-violet-500 mt-0.5 font-mono text-[9px]">{edge.es_pattern}</span>
            </p>
          ))}
        </div>
      )}

      {matchLine && !graphEdges?.length && relation?.type !== "same_dish" && relation?.type !== "same_hawker" && !compact && (
        <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">{matchLine}</p>
      )}

      {(inLex || inOss || inJina) && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100">
          {inLex && <ColumnTag label="Keywords" tone="slate" />}
          {inOss && <ColumnTag label={newOss ? "E5 · New" : "E5"} tone={newOss ? "sky" : "slate"} />}
          {inJina && <ColumnTag label={newJina ? "Jina · New" : "Jina"} tone={newJina ? "brand" : "slate"} />}
          {inAllThree && <ColumnTag label="All 3" tone="amber" />}
        </div>
      )}
    </div>
  );
}

interface HopNeighbor {
  edge: GraphEdge;
  hit: Hit;
  viaTitle?: string;
}

function GraphNeighborRow({
  item,
  onSelect,
  faded = false,
}: {
  item: HopNeighbor;
  onSelect: (hit: Hit) => void;
  faded?: boolean;
}) {
  const { edge, hit, viaTitle } = item;
  const style = EDGE_STYLE[edge.edge_type];
  const shortTitle = hit.title.split("—")[0].trim();

  return (
    <button
      type="button"
      onClick={() => onSelect(hit)}
      className={`w-full text-left flex gap-2 rounded-md border px-2 py-1.5 touch-manipulation transition hover:bg-white ${
        faded ? "border-slate-200/80 bg-white/50 opacity-90" : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <span
        className="shrink-0 w-1 self-stretch rounded-full"
        style={{ backgroundColor: style.color, opacity: faded ? 0.55 : 1 }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-900 leading-snug truncate">{shortTitle}</p>
        {hit.hawker_centre && (
          <p className="text-[10px] text-sky-800 font-medium truncate">{hit.hawker_centre}</p>
        )}
        {hit.signature_dish && (
          <p className="text-[10px] text-slate-600 truncate">{hit.signature_dish}</p>
        )}
        <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">{edge.label}</p>
        {viaTitle && (
          <p className="text-[9px] text-violet-600 mt-0.5 truncate">via {viaTitle}</p>
        )}
      </div>
    </button>
  );
}

function GraphHopPanel({
  hop,
  neighbors,
  onSelect,
  expanded,
}: {
  hop: 1 | 2;
  neighbors: HopNeighbor[];
  onSelect: (hit: Hit) => void;
  expanded: boolean;
}) {
  if (neighbors.length === 0) return null;

  const title = hop === 1 ? "Hop 1 · direct neighbors" : "Hop 2 · chained from hop 1";
  const subtitle =
    hop === 1
      ? "term filter on dish_id · term on hawker_centre"
      : "chained term filters from hop-1 stalls";

  return (
    <div
      className={`rounded-lg border px-2 py-2 ${
        hop === 1 ? "border-violet-200 bg-violet-50/40" : "border-slate-200 bg-slate-50/80"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">{title}</p>
        <span className="text-[9px] text-slate-500 shrink-0">{neighbors.length} edge{neighbors.length !== 1 ? "s" : ""}</span>
      </div>
      <p className="text-[9px] text-slate-500 mb-2 leading-snug">{subtitle}</p>
      <div
        className={`grid gap-1.5 ${
          expanded ? "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 max-h-[140px] overflow-y-auto scroll-touch"
        }`}
      >
        {neighbors.map((item) => (
          <GraphNeighborRow
            key={`${item.edge.hop}-${item.edge.source_id}-${item.edge.target_id}-${item.edge.edge_type}`}
            item={item}
            onSelect={onSelect}
            faded={hop === 2}
          />
        ))}
      </div>
    </div>
  );
}

function buildHopNeighbors(
  edges: GraphEdge[],
  nodeById: Map<string, Hit>,
  hits: Hit[],
): HopNeighbor[] {
  const hitById = new Map(hits.map((h) => [h.doc_id, h]));
  const items: HopNeighbor[] = [];

  for (const edge of edges) {
    const node = nodeById.get(edge.target_id) ?? hitById.get(edge.target_id);
    if (!node?.location) continue;
    const via = nodeById.get(edge.source_id) ?? hitById.get(edge.source_id);
    items.push({
      edge,
      hit: node,
      viaTitle: edge.hop >= 2 && via ? via.title.split("—")[0].trim() : undefined,
    });
  }

  return items;
}

interface Props {
  result: CompareResponse | null;
  selectedHit: Hit | null;
  onSelectHit?: (hit: Hit) => void;
  center?: { lat: number; lon: number };
  radiusM?: number;
  className?: string;
}

export function SyncMapView({
  result,
  selectedHit,
  onSelectHit,
  center,
  radiusM,
  className = "",
}: Props) {
  const defaultCenter: [number, number] = [1.29, 103.85];
  const hits = useMemo(() => collectMapHits(result), [result]);
  const hitIds = useMemo(() => new Set(hits.map((h) => h.doc_id)), [hits]);

  const [showGraph, setShowGraph] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [popupDocId, setPopupDocId] = useState<string | null>(null);
  const [graph, setGraph] = useState<VenueGraphResponse | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  useEffect(() => {
    if (selectedHit?.doc_id) setPopupDocId(selectedHit.doc_id);
  }, [selectedHit?.doc_id]);

  useEffect(() => {
    if (!selectedHit?.doc_id || !showGraph) {
      setGraph(null);
      return;
    }
    const controller = new AbortController();
    setGraphLoading(true);
    fetch(
      `/search/graph/${encodeURIComponent(selectedHit.doc_id)}?hops=2&limit=2`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: VenueGraphResponse | null) => setGraph(data))
      .catch(() => setGraph(null))
      .finally(() => setGraphLoading(false));
    return () => controller.abort();
  }, [selectedHit?.doc_id, showGraph]);

  const positionsById = useMemo(() => {
    const m = new Map<string, { lat: number; lon: number }>();
    if (selectedHit?.location) m.set(selectedHit.doc_id, selectedHit.location);
    for (const h of hits) {
      if (h.location) m.set(h.doc_id, h.location);
    }
    for (const n of graph?.nodes ?? []) {
      if (n.location) m.set(n.doc_id, n.location);
    }
    return m;
  }, [selectedHit, hits, graph]);

  const metaById = useMemo(() => {
    const m = new Map<string, { hawker_centre?: string }>();
    if (selectedHit) m.set(selectedHit.doc_id, { hawker_centre: selectedHit.hawker_centre });
    for (const h of hits) m.set(h.doc_id, { hawker_centre: h.hawker_centre });
    for (const n of graph?.nodes ?? []) m.set(n.doc_id, { hawker_centre: n.hawker_centre });
    return m;
  }, [selectedHit, hits, graph]);

  const rawFitPoints = useMemo((): [number, number][] => {
    const pts: [number, number][] = [];
    if (selectedHit?.location) pts.push([selectedHit.location.lat, selectedHit.location.lon]);
    for (const n of graph?.nodes ?? []) {
      if (n.location) pts.push([n.location.lat, n.location.lon]);
    }
    return pts;
  }, [selectedHit, graph]);

  const rawFitSpanM = useMemo(() => maxSpanMeters(rawFitPoints), [rawFitPoints]);

  const displayPositionsById = useMemo(
    () => buildDisplayPositions(positionsById, metaById),
    [positionsById, metaById],
  );

  const graphPinsFanned = useMemo(() => {
    for (const [id, raw] of positionsById) {
      const display = displayPositionsById.get(id);
      if (!display) continue;
      if (Math.abs(raw.lat - display.lat) > 1e-7 || Math.abs(raw.lon - display.lon) > 1e-7) return true;
    }
    return false;
  }, [positionsById, displayPositionsById]);

  const fitPoints = useMemo((): [number, number][] => {
    const ids = new Set<string>();
    if (selectedHit?.doc_id) ids.add(selectedHit.doc_id);
    for (const n of graph?.nodes ?? []) ids.add(n.doc_id);
    return [...ids]
      .map((id) => displayPositionsById.get(id))
      .filter((p): p is { lat: number; lon: number } => !!p)
      .map((p) => [p.lat, p.lon] as [number, number]);
  }, [selectedHit, graph, displayPositionsById]);

  const edgesByTarget = useMemo(() => {
    const m = new Map<string, GraphEdge[]>();
    for (const e of graph?.edges ?? []) {
      const list = m.get(e.target_id) ?? [];
      list.push(e);
      m.set(e.target_id, list);
    }
    return m;
  }, [graph]);

  const graphNodeById = useMemo(() => {
    const m = new Map<string, Hit>();
    for (const n of graph?.nodes ?? []) m.set(n.doc_id, n);
    return m;
  }, [graph]);

  const handleSelectHit = (hit: Hit) => {
    setPopupDocId(hit.doc_id);
    const fromSearch = hits.find((h) => h.doc_id === hit.doc_id);
    const fromGraph = graphNodeById.get(hit.doc_id);
    const merged = fromSearch
      ? fromGraph
        ? { ...fromSearch, ...fromGraph, doc_id: fromSearch.doc_id, title: fromSearch.title }
        : fromSearch
      : fromGraph
        ? { ...hit, ...fromGraph, doc_id: hit.doc_id }
        : hit;
    onSelectHit?.(merged);
  };

  const graphOnlyPeers = useMemo(
    () => (graph?.nodes ?? []).filter((n) => n.location && !hitIds.has(n.doc_id)),
    [graph, hitIds],
  );

  const graphActive = showGraph && !!graph && graph.edges.length > 0;
  const graphFitKey = `${selectedHit?.doc_id ?? ""}:${graph?.edges.length ?? 0}`;

  const displayHit = useMemo(() => {
    if (!selectedHit) return null;
    const fromGraph = graphNodeById.get(selectedHit.doc_id);
    const fromSearch = hits.find((h) => h.doc_id === selectedHit.doc_id);
    const base = fromSearch ?? selectedHit;
    return fromGraph ? { ...base, ...fromGraph, doc_id: base.doc_id, title: base.title } : base;
  }, [selectedHit, hits, graphNodeById]);

  const displayInResults = selectedHit ? hitIds.has(selectedHit.doc_id) : false;

  const hop1Neighbors = useMemo(
    () => buildHopNeighbors((graph?.edges ?? []).filter((e) => e.hop === 1), graphNodeById, hits),
    [graph, graphNodeById, hits],
  );

  const hop2Neighbors = useMemo(
    () => buildHopNeighbors((graph?.edges ?? []).filter((e) => e.hop === 2), graphNodeById, hits),
    [graph, graphNodeById, hits],
  );

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  const shellClass = expanded
    ? "fixed inset-3 z-[101] rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col min-h-0 h-[calc(100vh-1.5rem)]"
    : `flex flex-col h-full min-h-0 ${className}`;

  const mapBody = (
    <>
      <header
        className={`shrink-0 px-2 md:px-3 py-2 md:py-2.5 border-b border-slate-200 bg-slate-100 ${
          expanded ? "max-h-[46vh] overflow-y-auto scroll-touch" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-wide leading-tight text-slate-600">
              Map · scroll to zoom
            </p>
            <p className="text-[11px] sm:text-xs text-slate-600 line-clamp-2 leading-snug mt-0.5">
              {hits.length > 0
                ? `${hits.length} pins · select for 2-hop graph`
                : "Run a search to plot venues"}
            </p>
            {selectedHit && showGraph && graph && graph.edges.length > 0 && (
              <p className="text-[10px] text-violet-700 mt-1 leading-snug">{graph.summary}</p>
            )}
            {selectedHit && graphLoading && (
              <p className="text-[10px] text-slate-400 mt-1">Expanding graph…</p>
            )}
            {graphPinsFanned && (
              <p className="text-[10px] text-sky-700 mt-1 leading-snug">
                Same hawker — pins fanned out so graph lines stay visible
              </p>
            )}
          </div>
          <div className="shrink-0 flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600 touch-manipulation hover:bg-slate-50"
            >
              {expanded ? "Close" : "Expand"}
            </button>
            {selectedHit && (
              <button
                type="button"
                onClick={() => setShowGraph((v) => !v)}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border touch-manipulation ${
                  showGraph
                    ? "bg-violet-100 text-violet-800 border-violet-200"
                    : "bg-white text-slate-500 border-slate-200"
                }`}
              >
                Graph {showGraph ? "on" : "off"}
              </button>
            )}
          </div>
        </div>
        {showGraph && graph && graph.edges.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-2 border-t border-slate-200/80">
            <LegendDot color={EDGE_STYLE.same_dish.color} label="Same dish" />
            <LegendDot color={EDGE_STYLE.same_hawker.color} label="Same hawker" />
            <span className="text-[9px] text-slate-400 w-full sm:w-auto">Solid = hop 1 · Faded = hop 2 · term filters only</span>
          </div>
        )}
        {displayHit && (
          <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-2">
            <div className="rounded-lg border border-emerald-200 bg-white p-2 shadow-sm">
              {!displayInResults && (
                <p className="text-[9px] font-medium uppercase tracking-wide text-violet-600 mb-1.5">
                  Graph discovery · not in search results
                </p>
              )}
              <VenuePopup hit={displayHit} result={result} centerHit={displayHit} compact />
            </div>
            {showGraph && graph && hop1Neighbors.length > 0 && (
              <GraphHopPanel hop={1} neighbors={hop1Neighbors} onSelect={handleSelectHit} expanded={expanded} />
            )}
          </div>
        )}
        {showGraph && graph && hop2Neighbors.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200/80">
            <GraphHopPanel hop={2} neighbors={hop2Neighbors} onSelect={handleSelectHit} expanded={expanded} />
          </div>
        )}
      </header>
      <div className="relative flex-1 min-h-0">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          scrollWheelZoom
          zoomControl
          closePopupOnClick={false}
          className="absolute inset-0 h-full w-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {center && radiusM && (
            <Circle
              center={[center.lat, center.lon]}
              radius={radiusM}
              pathOptions={{ color: "#00B14F", fillOpacity: 0.08, interactive: false }}
            />
          )}
          {showGraph &&
            graph?.edges.map((edge) => {
              const from = displayPositionsById.get(edge.source_id);
              const to = displayPositionsById.get(edge.target_id);
              if (!from || !to) return null;
              const style = EDGE_STYLE[edge.edge_type];
              const isHop2 = edge.hop >= 2;
              const sameSpot =
                Math.abs(from.lat - to.lat) < 1e-7 && Math.abs(from.lon - to.lon) < 1e-7;
              return (
                <Polyline
                  key={`${edge.hop}-${edge.source_id}-${edge.target_id}-${edge.edge_type}`}
                  positions={
                    sameSpot
                      ? [
                          [from.lat, from.lon],
                          [from.lat + 0.00035, from.lon + 0.00025],
                          [to.lat, to.lon],
                        ]
                      : [
                          [from.lat, from.lon],
                          [to.lat, to.lon],
                        ]
                  }
                  pathOptions={{
                    color: style.color,
                    weight: isHop2 ? 2.5 : 4,
                    opacity: isHop2 ? 0.55 : 0.9,
                    dashArray: isHop2 ? "4 6" : style.dashArray,
                    interactive: false,
                  }}
                />
              );
            })}
          {graphOnlyPeers.map((hit) => {
            const pos = displayPositionsById.get(hit.doc_id);
            if (!pos) return null;
            return (
            <MapMarker
              key={`graph-${hit.doc_id}`}
              hit={hit}
              position={pos}
              icon={graphPeerIcon}
              zIndexOffset={500}
              isOpen={popupDocId === hit.doc_id}
              onSelect={handleSelectHit}
            >
              <VenuePopup
                hit={hit}
                result={result}
                graphEdges={edgesByTarget.get(hit.doc_id)}
                centerHit={selectedHit}
              />
            </MapMarker>
            );
          })}
          {hits.map((hit) => {
            const isSelected = selectedHit?.doc_id === hit.doc_id;
            const pos = displayPositionsById.get(hit.doc_id);
            if (!pos) return null;
            const mergedHit = graphNodeById.get(hit.doc_id)
              ? { ...hit, ...graphNodeById.get(hit.doc_id)!, doc_id: hit.doc_id, title: hit.title }
              : hit;
            return (
              <MapMarker
                key={hit.doc_id}
                hit={hit}
                position={pos}
                icon={isSelected ? selectedPinIcon : pinIcon}
                zIndexOffset={isSelected ? 1000 : 0}
                isOpen={popupDocId === hit.doc_id}
                onSelect={handleSelectHit}
              >
                <VenuePopup
                  hit={mergedHit}
                  result={result}
                  graphEdges={edgesByTarget.get(hit.doc_id)}
                  centerHit={selectedHit}
                />
              </MapMarker>
            );
          })}
          <MapViewController
            expanded={expanded}
            fitPoints={fitPoints}
            rawFitSpanM={rawFitSpanM}
            graphFitKey={graphFitKey}
            graphActive={graphActive}
            selectedHit={selectedHit}
          />
        </MapContainer>
      </div>
    </>
  );

  const mapPanel = (
    <div key="sync-map-panel" className={shellClass}>
      {mapBody}
    </div>
  );

  return (
    <>
      {expanded && <div className={`flex flex-col h-full min-h-0 ${className}`} aria-hidden />}
      {expanded ? (
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[100] bg-slate-900/40"
              aria-label="Close expanded map"
              onClick={() => setExpanded(false)}
            />
            {mapPanel}
          </>,
          document.body,
        )
      ) : (
        mapPanel
      )}
    </>
  );
}

function LegendDot({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] text-slate-500">
      <span
        className="w-4 h-0.5 rounded-full"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
          height: dashed ? 0 : undefined,
        }}
      />
      {label}
    </span>
  );
}
