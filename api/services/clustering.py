"""Unsupervised venue clustering — density-probed kNN centroids + significant_text labels.

Inspired by Elasticsearch Labs: Jina clustering embeddings + msearch kNN + significant_text.
"""

from __future__ import annotations

import math
import random
import re
import time
from collections import Counter
from typing import Any

from api.config import CORPUS_INDEX
from api.models import DiscoverCluster, DiscoverClusterTerm, DiscoverClustersResponse, Hit
from api.services.elasticsearch import (
    VENUE_DOC_TYPES,
    _client,
    es_configured,
    load_local_corpus,
)

CLUSTERING_FIELD = "embedding_clustering"
RETRIEVAL_FIELD = "embedding"
VECTOR_DIMS = 1024

PROBE_FRACTION = 0.05
MIN_PROBES = 20
MSSEARCH_BATCH = 50
SIMILARITY_THRESHOLD = 0.68
SEED_SEPARATION = 0.82
MIN_CLUSTER_SIZE = 3
KNN_CLASSIFY_K = 40
KNN_PROBE_K = 25
NUM_CANDIDATES = 80

GENERIC_LABEL_TERMS = frozenset(
    {
        "the",
        "and",
        "for",
        "with",
        "food",
        "singapore",
        "stall",
        "stalls",
        "hawker",
        "centre",
        "restaurant",
        "local",
        "famous",
        "best",
        "good",
        "great",
        "fresh",
        "traditional",
        "authentic",
        "popular",
        "serving",
        "served",
        "made",
        "using",
        "style",
        "classic",
        "special",
        "house",
        "signature",
        "dish",
        "dishes",
    }
)

_cache: dict[str, tuple[float, DiscoverClustersResponse]] = {}
CACHE_TTL_SEC = 600


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _clean_label_term(term: str) -> str | None:
    t = term.strip().lower()
    if not t or len(t) < 2:
        return None
    if t.isdigit() or re.fullmatch(r"\d+[a-z]?", t):
        return None
    if t in GENERIC_LABEL_TERMS:
        return None
    return t


def _build_label(terms: list[DiscoverClusterTerm], fallback_title: str | None) -> str:
    cleaned = []
    for item in terms:
        t = _clean_label_term(item.term)
        if t and t not in cleaned:
            cleaned.append(t)
        if len(cleaned) >= 4:
            break
    if cleaned:
        return " · ".join(cleaned[:4])
    if fallback_title:
        return fallback_title[:60]
    return "Food cluster"


GENERIC_AREAS = frozenset(
    {
        "downtown core",
        "central",
        "singapore",
        "cbd",
        "city",
        "north",
        "south",
        "east",
        "west",
    }
)


def _best_hawker(members: list[dict]) -> str | None:
    counts: Counter[str] = Counter()
    for m in members:
        h = m.get("hawker_centre")
        if h:
            counts[str(h).strip()] += 1
    if not counts:
        return None
    name, n = counts.most_common(1)[0]
    return name if n >= 2 else None


def _best_area(members: list[dict]) -> str | None:
    counts: Counter[str] = Counter()
    for m in members:
        for field in ("neighbourhood", "nearest_mrt", "planning_area"):
            val = m.get(field)
            if isinstance(val, list):
                val = val[0] if val else None
            if val and str(val).strip().lower() not in GENERIC_AREAS:
                counts[str(val).strip()] += 1
    if counts:
        return counts.most_common(1)[0][0]
    return _mode_field(members, "neighbourhood") or _mode_field(members, "planning_area")


def _format_dish(raw: str | None) -> str | None:
    if not raw:
        return None
    text = str(raw).strip()
    if "_" in text and text == text.lower():
        return text.replace("_", " ").title()
    return text


def _mode_field(members: list[dict], field: str, *, min_share: float = 0.0) -> str | None:
    counts: Counter[str] = Counter()
    for m in members:
        val = m.get(field)
        if isinstance(val, list):
            val = val[0] if val else None
        if val:
            counts[str(val).strip()] += 1
    if not counts:
        return None
    top, n = counts.most_common(1)[0]
    if min_share and n / len(members) < min_share:
        return None
    return top


def _title_noise_tokens(members: list[dict]) -> set[str]:
    noise: set[str] = set()
    for m in members:
        title = str(m.get("title", "")).lower()
        for tok in re.findall(r"[a-z]{4,}", title):
            noise.add(tok)
    return noise


def _filter_sig_terms(terms: list[DiscoverClusterTerm], members: list[dict]) -> list[DiscoverClusterTerm]:
    title_noise = _title_noise_tokens(members)
    out: list[DiscoverClusterTerm] = []
    for t in terms:
        cleaned = _clean_label_term(t.term)
        if not cleaned or cleaned in title_noise:
            continue
        if cleaned not in {x.term for x in out}:
            out.append(DiscoverClusterTerm(term=cleaned, score=t.score))
    return out[:8]


def _describe_cluster(
    members: list[dict],
    sig_terms: list[DiscoverClusterTerm],
) -> tuple[str, str | None, str, list[DiscoverClusterTerm]]:
    """Build human labels from venue metadata — hawker centre, neighbourhood, dish."""
    sources = [m if "title" in m else m.get("source", m) for m in members]
    dish = _format_dish(_mode_field(sources, "signature_dish") or _mode_field(sources, "dish_id"))
    hawker = _best_hawker(sources)
    area = _best_area(sources)
    cuisine = _mode_field(sources, "cuisine", min_share=0.35)

    terms = _filter_sig_terms(sig_terms, sources)

    label_parts: list[str] = []
    subtitle: str | None = None

    if hawker:
        label_parts.append(hawker)
        if dish:
            label_parts.append(dish)
        subtitle = area
    elif area and dish:
        label_parts = [area, dish]
        subtitle = cuisine
    elif dish:
        label_parts = [dish]
        subtitle = area or cuisine
    elif area:
        label_parts = [area]
        subtitle = cuisine
    elif terms:
        label_parts = [terms[0].term.title()]
    else:
        label_parts = ["Singapore hawker food"]

    label = " · ".join(label_parts[:2])

    query_parts: list[str] = []
    if dish:
        query_parts.append(dish.lower())
    if hawker:
        query_parts.append(hawker.lower())
    elif area:
        query_parts.append(area.lower())
    search_query = " ".join(query_parts[:2]) or label.replace(" · ", " ").lower()

    if not subtitle:
        subtitle = cuisine or _mode_field(sources, "vibes")

    return label, subtitle, search_query, terms


def _sort_clusters(clusters: list[DiscoverCluster]) -> list[DiscoverCluster]:
    return sorted(clusters, key=lambda c: c.size, reverse=True)


def _venue_filters() -> list[dict]:
    return [{"terms": {"doc_type": list(VENUE_DOC_TYPES)}}]


def _resolve_vector_field(es) -> str:
    try:
        resp = es.count(index=CORPUS_INDEX, query={"exists": {"field": CLUSTERING_FIELD}})
        if int(resp.body.get("count", 0)) > 0:
            return CLUSTERING_FIELD
    except Exception:
        pass
    return RETRIEVAL_FIELD


def _fetch_venue_vectors(es, vector_field: str) -> list[dict[str, Any]]:
    resp = es.search(
        index=CORPUS_INDEX,
        body={
            "size": 500,
            "query": {"bool": {"filter": _venue_filters()}},
            "_source": [
                "doc_id",
                "title",
                "description",
                "signature_dish",
                "dish_id",
                "hawker_centre",
                "neighbourhood",
                "planning_area",
                "cuisine",
                "vibes",
                "doc_type",
                "location",
                "hero_image_url",
                "rating",
                "price_range",
                vector_field,
            ],
        },
    )
    rows: list[dict[str, Any]] = []
    for hit in resp.body["hits"]["hits"]:
        src = hit["_source"]
        vec = src.get(vector_field)
        if not vec or not isinstance(vec, list):
            continue
        rows.append(
            {
                "doc_id": src.get("doc_id", hit["_id"]),
                "_id": hit["_id"],
                "vector": vec,
                "source": src,
            }
        )
    return rows


def _msearch_knn_means(
    es,
    probes: list[dict[str, Any]],
    vector_field: str,
    *,
    k: int,
) -> list[float]:
    """Return mean top-k similarity for each probe vector."""
    means: list[float] = []
    filters = _venue_filters()

    for batch_start in range(0, len(probes), MSSEARCH_BATCH):
        batch = probes[batch_start : batch_start + MSSEARCH_BATCH]
        body: list[dict[str, Any]] = []
        for probe in batch:
            body.append({"index": CORPUS_INDEX})
            body.append(
                {
                    "size": k,
                    "knn": {
                        "field": vector_field,
                        "query_vector": probe["vector"],
                        "k": k,
                        "num_candidates": NUM_CANDIDATES,
                        "filter": filters,
                    },
                    "_source": False,
                }
            )
        if not body:
            continue
        resp = es.msearch(body=body)
        for item in resp.body["responses"]:
            scores = [h.get("_score", 0.0) for h in item.get("hits", {}).get("hits", [])]
            means.append(sum(scores) / len(scores) if scores else 0.0)
    return means


def _select_diverse_seeds(
    probes: list[dict[str, Any]],
    densities: list[float],
    *,
    separation: float,
) -> list[dict[str, Any]]:
    median = sorted(densities)[len(densities) // 2] if densities else 0.0
    ranked = sorted(zip(probes, densities), key=lambda x: x[1], reverse=True)
    seeds: list[dict[str, Any]] = []
    seed_vecs: list[list[float]] = []

    for probe, density in ranked:
        if density < median:
            continue
        vec = probe["vector"]
        if any(_cosine(vec, s) >= separation for s in seed_vecs):
            continue
        seeds.append({**probe, "density": density})
        seed_vecs.append(vec)

    return seeds


def _classify_against_seeds(
    es,
    rows: list[dict[str, Any]],
    seeds: list[dict[str, Any]],
    vector_field: str,
) -> tuple[dict[str, list[str]], set[str]]:
    """Assign each doc to the seed centroid with the highest kNN score above threshold."""
    best_for_doc: dict[str, tuple[str, float]] = {}
    filters = _venue_filters()

    for batch_start in range(0, len(seeds), MSSEARCH_BATCH):
        batch = seeds[batch_start : batch_start + MSSEARCH_BATCH]
        body: list[dict[str, Any]] = []
        for seed in batch:
            body.append({"index": CORPUS_INDEX})
            body.append(
                {
                    "size": KNN_CLASSIFY_K,
                    "knn": {
                        "field": vector_field,
                        "query_vector": seed["vector"],
                        "k": KNN_CLASSIFY_K,
                        "num_candidates": max(NUM_CANDIDATES, KNN_CLASSIFY_K * 2),
                        "filter": filters,
                    },
                    "_source": ["doc_id"],
                }
            )
        if not body:
            continue
        resp = es.msearch(body=body)
        for seed, item in zip(batch, resp.body["responses"]):
            seed_id = seed["doc_id"]
            for hit in item.get("hits", {}).get("hits", []):
                score = float(hit.get("_score") or 0.0)
                if score < SIMILARITY_THRESHOLD:
                    continue
                doc_id = hit["_source"].get("doc_id", hit["_id"])
                prev = best_for_doc.get(doc_id)
                if prev is None or score > prev[1]:
                    best_for_doc[doc_id] = (seed_id, score)

    assignments: dict[str, list[str]] = {s["doc_id"]: [] for s in seeds}
    for doc_id, (seed_id, _) in best_for_doc.items():
        if seed_id in assignments:
            assignments[seed_id].append(doc_id)

    noise: set[str] = set()
    all_ids = {r["doc_id"] for r in rows}
    for seed_id, members in list(assignments.items()):
        if seed_id not in members:
            members.append(seed_id)
        if len(members) < MIN_CLUSTER_SIZE:
            noise.update(members)
            assignments.pop(seed_id, None)
        else:
            for m in members:
                all_ids.discard(m)
    noise.update(all_ids)
    return assignments, noise


def _significant_terms_for_cluster(es, doc_ids: list[str]) -> list[DiscoverClusterTerm]:
    if not doc_ids:
        return []
    body = {
        "size": 0,
        "query": {"terms": {"doc_id": doc_ids}},
        "aggs": {
            "sig_dish": {
                "significant_text": {
                    "field": "signature_dish",
                    "size": 8,
                    "filter_duplicate_text": True,
                    "background_filter": {"bool": {"filter": _venue_filters()}},
                }
            },
            "sig_title": {
                "significant_text": {
                    "field": "title",
                    "size": 6,
                    "filter_duplicate_text": True,
                    "background_filter": {"bool": {"filter": _venue_filters()}},
                }
            },
            "sig_hawker": {
                "significant_text": {
                    "field": "hawker_centre",
                    "size": 5,
                    "filter_duplicate_text": True,
                    "background_filter": {"bool": {"filter": _venue_filters()}},
                }
            },
            "sig_cuisine": {
                "significant_terms": {
                    "field": "cuisine",
                    "size": 5,
                    "background_filter": {"bool": {"filter": _venue_filters()}},
                }
            },
            "sig_area": {
                "significant_terms": {
                    "field": "neighbourhood",
                    "size": 5,
                    "background_filter": {"bool": {"filter": _venue_filters()}},
                }
            },
        },
    }
    try:
        resp = es.search(index=CORPUS_INDEX, body=body)
    except Exception:
        return []

    terms: list[DiscoverClusterTerm] = []
    aggs = resp.body.get("aggregations", {})
    priority = ("sig_dish", "sig_area", "sig_cuisine", "sig_hawker", "sig_title")
    seen_terms: set[str] = set()
    for key in priority:
        agg = aggs.get(key, {})
        buckets = agg.get("buckets", [])
        for b in buckets:
            term = b.get("key", "")
            score = float(b.get("score", b.get("significance", 0)) or 0)
            cleaned = _clean_label_term(str(term))
            if cleaned and cleaned not in seen_terms:
                seen_terms.add(cleaned)
                terms.append(DiscoverClusterTerm(term=cleaned, score=score))
    terms.sort(key=lambda t: t.score, reverse=True)
    return terms


def _row_to_hit(row: dict[str, Any], reason: str) -> Hit:
    src = row["source"]
    return Hit(
        doc_id=row["doc_id"],
        title=src.get("title", ""),
        doc_type=src.get("doc_type", ""),
        signature_dish=src.get("signature_dish"),
        dish_id=src.get("dish_id"),
        hawker_centre=src.get("hawker_centre"),
        neighbourhood=src.get("neighbourhood") or src.get("planning_area"),
        location=src.get("location"),
        hero_image_url=src.get("hero_image_url"),
        rating=src.get("rating"),
        price_range=src.get("price_range"),
        match_reason=reason,
    )


def _cluster_es(*, refresh: bool = False) -> DiscoverClustersResponse:
    cache_key = f"es:{CORPUS_INDEX}:{CLUSTERING_FIELD}"
    if not refresh and cache_key in _cache:
        ts, cached = _cache[cache_key]
        if time.time() - ts < CACHE_TTL_SEC:
            return cached

    t0 = time.time()
    es = _client()
    vector_field = _resolve_vector_field(es)
    rows = _fetch_venue_vectors(es, vector_field)
    if len(rows) < MIN_CLUSTER_SIZE:
        return DiscoverClustersResponse(
            clusters=[],
            noise_count=0,
            total_venues=len(rows),
            took_ms=int((time.time() - t0) * 1000),
            engine="density_probe_knn",
            vector_field=vector_field,
            summary="Not enough embedded venues — run scripts/backfill_clustering_embeddings.py",
        )

    probe_count = max(MIN_PROBES, int(len(rows) * PROBE_FRACTION))
    probe_count = min(probe_count, len(rows))
    probes = random.sample(rows, probe_count)
    densities = _msearch_knn_means(es, probes, vector_field, k=KNN_PROBE_K)
    seeds = _select_diverse_seeds(probes, densities, separation=SEED_SEPARATION)

    if not seeds:
        return DiscoverClustersResponse(
            clusters=[],
            noise_count=len(rows),
            total_venues=len(rows),
            took_ms=int((time.time() - t0) * 1000),
            engine="density_probe_knn",
            vector_field=vector_field,
            summary="No dense seeds found — try lowering similarity threshold or backfill clustering embeddings",
        )

    assignments, noise_ids = _classify_against_seeds(es, rows, seeds, vector_field)
    row_by_id = {r["doc_id"]: r for r in rows}
    seed_density = {s["doc_id"]: float(s.get("density") or 0) for s in seeds}
    clusters: list[DiscoverCluster] = []

    for idx, (seed_id, member_ids) in enumerate(
        sorted(assignments.items(), key=lambda x: len(x[1]), reverse=True), start=1
    ):
        members = [row_by_id[d] for d in member_ids if d in row_by_id]
        if not members:
            continue
        member_sources = [m["source"] for m in members]
        sig_terms = _significant_terms_for_cluster(es, member_ids)
        label, subtitle, search_query, terms = _describe_cluster(member_sources, sig_terms)
        sample = [_row_to_hit(m, f"{label}") for m in members[:5]]
        clusters.append(
            DiscoverCluster(
                cluster_id=f"c{idx}",
                label=label,
                subtitle=subtitle,
                terms=terms,
                size=len(member_ids),
                sample_hits=sample,
                density=seed_density.get(seed_id),
                search_query=search_query,
            )
        )

    noise_count = len(noise_ids)
    pct = int(100 * noise_count / len(rows)) if rows else 0
    field_note = (
        "Jina task=clustering"
        if vector_field == CLUSTERING_FIELD
        else "retrieval embeddings (run backfill_clustering_embeddings for tighter clusters)"
    )
    sorted_clusters = _sort_clusters(clusters)
    result = DiscoverClustersResponse(
        clusters=sorted_clusters,
        noise_count=noise_count,
        total_venues=len(rows),
        took_ms=int((time.time() - t0) * 1000),
        engine="density_probe_knn",
        vector_field=vector_field,
        summary=f"{len(sorted_clusters)} food scenes · {noise_count} unclustered ({pct}%) · {field_note}",
    )
    _cache[cache_key] = (time.time(), result)
    return result


def _local_significant_terms(docs: list[dict]) -> list[DiscoverClusterTerm]:
    bg = load_local_corpus()
    bg = [d for d in bg if d.get("doc_type") in VENUE_DOC_TYPES]
    counters: Counter[str] = Counter()
    bg_counters: Counter[str] = Counter()

    def tokens(doc: dict) -> list[str]:
        parts = [
            doc.get("signature_dish", ""),
            doc.get("neighbourhood", ""),
            doc.get("cuisine", ""),
            doc.get("hawker_centre", ""),
        ]
        out: list[str] = []
        for p in parts:
            if p:
                out.extend(re.findall(r"[a-z0-9]+", str(p).lower()))
        return out

    for d in bg:
        bg_counters.update(tokens(d))
    for d in docs:
        counters.update(tokens(d))

    scored: list[DiscoverClusterTerm] = []
    bg_size = max(len(bg), 1)
    for term, fg in counters.items():
        if _clean_label_term(term) is None:
            continue
        bg_count = bg_counters.get(term, 0) + 1
        score = (fg / len(docs)) / (bg_count / bg_size)
        scored.append(DiscoverClusterTerm(term=term, score=score))
    scored.sort(key=lambda t: t.score, reverse=True)
    return scored[:10]


def _cluster_local() -> DiscoverClustersResponse:
    t0 = time.time()
    docs = [
        d
        for d in load_local_corpus()
        if d.get("doc_type") in VENUE_DOC_TYPES and d.get("map_visible", True) is not False
    ]
    buckets: dict[tuple[str, str], list[dict]] = {}
    for d in docs:
        cuisine = d.get("cuisine") or "mixed"
        if isinstance(cuisine, list):
            cuisine = cuisine[0] if cuisine else "mixed"
        area = d.get("planning_area") or d.get("neighbourhood") or "sg"
        if isinstance(area, list):
            area = area[0] if area else "sg"
        key = (str(cuisine), str(area))
        buckets.setdefault(key, []).append(d)

    clusters: list[DiscoverCluster] = []
    noise_count = 0
    for idx, ((cuisine, area), members) in enumerate(
        sorted(buckets.items(), key=lambda x: len(x[1]), reverse=True), start=1
    ):
        if len(members) < MIN_CLUSTER_SIZE:
            noise_count += len(members)
            continue
        terms = _local_significant_terms(members)
        label, subtitle, search_query, filtered_terms = _describe_cluster(members, terms)
        sample = [
            Hit(
                doc_id=m["doc_id"],
                title=m.get("title", ""),
                doc_type=m.get("doc_type", ""),
                signature_dish=m.get("signature_dish"),
                dish_id=m.get("dish_id"),
                hawker_centre=m.get("hawker_centre"),
                neighbourhood=m.get("neighbourhood"),
                location=m.get("location"),
                hero_image_url=m.get("hero_image_url"),
                match_reason=label,
            )
            for m in members[:5]
        ]
        clusters.append(
            DiscoverCluster(
                cluster_id=f"c{idx}",
                label=label,
                subtitle=subtitle,
                terms=filtered_terms,
                size=len(members),
                sample_hits=sample,
                search_query=search_query,
            )
        )

    sorted_clusters = _sort_clusters(clusters[:12])
    return DiscoverClustersResponse(
        clusters=sorted_clusters,
        noise_count=noise_count,
        total_venues=len(docs),
        took_ms=int((time.time() - t0) * 1000),
        engine="local_heuristic",
        vector_field="n/a",
        summary=f"{len(sorted_clusters)} food scenes by cuisine and area (local mode)",
    )


def discover_clusters(*, refresh: bool = False) -> DiscoverClustersResponse:
    if es_configured():
        try:
            return _cluster_es(refresh=refresh)
        except Exception as exc:
            msg = str(exc).lower()
            if "embedding_clustering" in msg or "dense_vector" in msg or "search_phase" in msg:
                return _cluster_local()
            raise
    return _cluster_local()
