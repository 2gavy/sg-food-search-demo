"""Elasticsearch search and index operations."""

from __future__ import annotations

import json
import math
import re
import time
from pathlib import Path
from typing import Any

from api.config import (
    CASES_INDEX,
    CORPUS_INDEX,
    DATA_DIR,
    ELASTICSEARCH_URL,
    ES_API_KEY,
)
from api.models import CompareDiff, CompareResponse, GraphEdge, Hit, SearchSide, VenueGraphResponse

LOCAL_CORPUS: list[dict] | None = None

# Searchable venue types — excludes dish_image catalog docs and food guides
VENUE_DOC_TYPES = ("hawker_stall", "restaurant", "cafe", "zi_char")
EXCLUDED_DOC_TYPES = ("food_guide", "dish_image")


def es_configured() -> bool:
    return bool(ELASTICSEARCH_URL and ES_API_KEY)


def _client():
    from elasticsearch import Elasticsearch

    return Elasticsearch(ELASTICSEARCH_URL, api_key=ES_API_KEY, request_timeout=120)


def load_local_corpus() -> list[dict]:
    global LOCAL_CORPUS
    if LOCAL_CORPUS is None:
        path = DATA_DIR / "sg_food_corpus.jsonl"
        LOCAL_CORPUS = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    return LOCAL_CORPUS


def _venue_filter(doc_types: list[str] | None, dietary: list[str] | None) -> list[dict]:
    docs = [
        d
        for d in load_local_corpus()
        if d.get("doc_type") not in EXCLUDED_DOC_TYPES and d.get("map_visible", True) is not False
    ]
    if doc_types:
        docs = [d for d in docs if d.get("doc_type") in doc_types]
    if dietary:
        docs = [
            d for d in docs
            if any(tag in d.get("dietary_tags", []) for tag in dietary)
        ]
    return docs


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _geo_filter_docs(docs: list[dict], lat: float | None, lon: float | None, radius_m: int | None) -> list[dict]:
    if lat is None or lon is None or not radius_m:
        return docs
    out = []
    for d in docs:
        loc = d.get("location")
        if not loc:
            continue
        dist = _haversine_m(lat, lon, loc["lat"], loc["lon"])
        if dist <= radius_m:
            d = {**d, "_distance": dist}
            out.append(d)
    return out


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _lexical_score(query: str, doc: dict) -> float:
    q = _tokenize(query)
    if not q:
        return 0.0
    text = " ".join(
        str(doc.get(k, "")) for k in ("title", "description", "signature_dish", "searchable_content", "neighbourhood")
    ).lower()
    tokens = _tokenize(text)
    overlap = len(q & tokens)
    title_bonus = sum(1 for t in q if t in doc.get("title", "").lower()) * 0.5
    return overlap + title_bonus


def _semantic_score(query: str, doc: dict, *, weight_vibes: float = 1.5) -> float:
    q = _tokenize(query)
    text = doc.get("searchable_content", "") + " " + " ".join(doc.get("vibes", []))
    tokens = _tokenize(text)
    overlap = len(q & tokens)
    extra = sum(1 for v in doc.get("vibes", []) if any(t in v.lower() for t in q))
    dish = doc.get("signature_dish", "").lower()
    dish_bonus = sum(2 for t in q if t in dish)
    return overlap * weight_vibes + extra + dish_bonus


def _doc_to_hit(doc: dict, score: float, rank: int, reason: str) -> Hit:
    loc = doc.get("location")
    return Hit(
        doc_id=doc["doc_id"],
        title=doc.get("title", ""),
        doc_type=doc.get("doc_type", ""),
        venue_tier=doc.get("venue_tier"),
        description=doc.get("description"),
        signature_dish=doc.get("signature_dish"),
        dish_id=doc.get("dish_id"),
        hawker_centre=doc.get("hawker_centre"),
        neighbourhood=doc.get("neighbourhood") or doc.get("planning_area"),
        location=loc,
        hero_image_url=doc.get("hero_image_url"),
        rating=doc.get("rating"),
        price_range=doc.get("price_range"),
        distance_metres=doc.get("_distance"),
        match_reason=reason,
        score=round(score, 3),
        rank=rank,
    )


def _build_diff(lexical: list[Hit], hybrid_oss: list[Hit], hybrid_jina: list[Hit]) -> CompareDiff:
    lx = {h.doc_id for h in lexical}
    ox = {h.doc_id for h in hybrid_oss}
    jx = {h.doc_id for h in hybrid_jina}
    return CompareDiff(
        hybrid_only_jina=sorted(jx - lx),
        hybrid_only_oss=sorted(ox - lx),
        lexical_only=sorted(lx - ox - jx),
        all_three=sorted(lx & ox & jx),
        jina_only=sorted(jx - ox),
        oss_only=sorted(ox - jx),
    )


def _local_compare(
    query: str,
    lat: float | None = None,
    lon: float | None = None,
    radius_m: int | None = None,
    doc_types: list[str] | None = None,
    dietary: list[str] | None = None,
    size: int = 10,
) -> CompareResponse:
    t0 = time.time()
    docs = _geo_filter_docs(_venue_filter(doc_types, dietary), lat, lon, radius_m)
    lex_scored = sorted(((_lexical_score(query, d), d) for d in docs), key=lambda x: -x[0])
    lex_hits = _normalize_result_hits(
        [_doc_to_hit(d, s, i + 1, f"lexical: matched tokens in {d.get('title','')[:40]}") for i, (s, d) in enumerate(lex_scored[: size * 3]) if s > 0],
        size,
    )
    t1 = time.time()
    oss_scored = sorted(
        ((max(_lexical_score(query, d) * 0.4, 0) + _semantic_score(query, d, weight_vibes=1.2), d) for d in docs),
        key=lambda x: -x[0],
    )
    oss_hits = _normalize_result_hits(
        [_doc_to_hit(d, s, i + 1, f"oss-semantic: {d.get('signature_dish','')}") for i, (s, d) in enumerate(oss_scored[: size * 3]) if s > 0],
        size,
    )
    t2 = time.time()
    jina_scored = sorted(
        ((max(_lexical_score(query, d) * 0.4, 0) + _semantic_score(query, d, weight_vibes=1.8), d) for d in docs),
        key=lambda x: -x[0],
    )
    jina_hits = _normalize_result_hits(
        [_doc_to_hit(d, s, i + 1, f"hybrid-jina: {d.get('signature_dish','')}") for i, (s, d) in enumerate(jina_scored[: size * 3]) if s > 0],
        size,
    )
    t3 = time.time()
    return CompareResponse(
        query=query,
        mode="text",
        lexical=SearchSide(hits=lex_hits, total=len(lex_hits), took_ms=int((t1 - t0) * 1000)),
        hybrid_oss=SearchSide(hits=oss_hits, total=len(oss_hits), took_ms=int((t2 - t1) * 1000)),
        hybrid_jina=SearchSide(hits=jina_hits, total=len(jina_hits), took_ms=int((t3 - t2) * 1000)),
        diff=_build_diff(lex_hits, oss_hits, jina_hits),
    )


def _build_es_filters(
    doc_types: list[str] | None,
    dietary: list[str] | None,
    geo: dict | None,
    *,
    venues_only: bool = False,
) -> list[dict]:
    filters: list[dict] = []
    if venues_only:
        allowed = [t for t in (doc_types or VENUE_DOC_TYPES) if t in VENUE_DOC_TYPES]
        filters.append({"terms": {"doc_type": allowed or list(VENUE_DOC_TYPES)}})
    else:
        filters.append({"bool": {"must_not": [{"terms": {"doc_type": list(EXCLUDED_DOC_TYPES)}}]}})
        if doc_types:
            filters.append({"terms": {"doc_type": doc_types}})
    if dietary:
        filters.append({"terms": {"dietary_tags": dietary}})
    if geo and geo.get("lat") is not None:
        filters.append(
            {
                "geo_distance": {
                    "distance": f"{geo.get('radius_m', 1500)}m",
                    "location": {"lat": geo["lat"], "lon": geo["lon"]},
                }
            }
        )
    return filters


def _parse_hits(resp: dict, reason_prefix: str) -> list[Hit]:
    hits = []
    for i, h in enumerate(resp.get("hits", {}).get("hits", [])):
        src = h.get("_source", {})
        loc = src.get("location")
        sort_dist = h.get("sort")
        distance = sort_dist[0] if sort_dist else None
        hits.append(
            Hit(
                doc_id=src.get("doc_id", h.get("_id", "")),
                title=src.get("title", ""),
                doc_type=src.get("doc_type", ""),
                venue_tier=src.get("venue_tier"),
                description=src.get("description"),
                signature_dish=src.get("signature_dish"),
                dish_id=src.get("dish_id"),
                hawker_centre=src.get("hawker_centre"),
                neighbourhood=src.get("neighbourhood") or src.get("planning_area"),
                location=loc,
                hero_image_url=src.get("hero_image_url"),
                rating=src.get("rating"),
                price_range=src.get("price_range"),
                distance_metres=distance,
                match_reason=f"{reason_prefix}: score {(h.get('_score') or 0):.2f}",
                score=h.get("_score"),
                rank=i + 1,
            )
        )
    return hits


def _lexical_search(es, query: str, filters: list[dict], lat: float | None, lon: float | None, size: int) -> tuple[list[Hit], dict]:
    lex_body: dict[str, Any] = {
        "size": size,
        "query": {
            "bool": {
                "must": [
                    {
                        "multi_match": {
                            "query": query,
                            "fields": ["title^3", "description", "signature_dish^2", "neighbourhood", "hawker_centre"],
                            "type": "best_fields",
                        }
                    }
                ],
                "filter": filters,
            }
        },
    }
    if lat is not None and lon is not None:
        lex_body["sort"] = [{"_geo_distance": {"location": {"lat": lat, "lon": lon}, "order": "asc", "unit": "m"}}]
    lex_resp = es.search(index=CORPUS_INDEX, body=lex_body)
    return _parse_hits(lex_resp.body, "lexical"), lex_resp.body


def _knn_search(
    es,
    vector: list[float],
    vector_field: str,
    filters: list[dict],
    size: int,
    reason_prefix: str,
    lat: float | None = None,
    lon: float | None = None,
) -> tuple[list[Hit], dict]:
    """Pure dense-vector semantic search (E5 or Jina embedding field)."""
    body: dict[str, Any] = {
        "size": size,
        "knn": {
            "field": vector_field,
            "query_vector": vector,
            "k": min(size * 3, 50),
            "num_candidates": max(size * 20, 200),
            "filter": filters,
        },
    }
    if lat is not None and lon is not None:
        body["sort"] = [{"_geo_distance": {"location": {"lat": lat, "lon": lon}, "order": "asc", "unit": "m"}}]
    resp = es.search(index=CORPUS_INDEX, body=body)
    return _parse_hits(resp.body, reason_prefix), resp.body


def _hybrid_rrf(
    es,
    query: str,
    vector: list[float],
    vector_field: str,
    filters: list[dict],
    size: int,
    reason_prefix: str,
    lat: float | None = None,
    lon: float | None = None,
) -> tuple[list[Hit], dict]:
    hyb_body: dict[str, Any] = {
        "size": size,
        "retriever": {
            "rrf": {
                "retrievers": [
                    {
                        "standard": {
                            "query": {
                                "bool": {
                                    "must": [
                                        {
                                            "multi_match": {
                                                "query": query,
                                                "fields": ["title^3", "description", "signature_dish^2"],
                                            }
                                        }
                                    ],
                                    "filter": filters,
                                }
                            }
                        }
                    },
                    {
                        "knn": {
                            "field": vector_field,
                            "query_vector": vector,
                            "k": size,
                            "num_candidates": max(size * 10, 100),
                            "filter": filters,
                        }
                    },
                ],
                "rank_window_size": 50,
                "rank_constant": 60,
            }
        },
    }
    try:
        hyb_resp = es.search(index=CORPUS_INDEX, body=hyb_body)
        hits = _parse_hits(hyb_resp.body, reason_prefix)
        if lat is not None and lon is not None:
            hits.sort(key=lambda h: (h.distance_metres is None, h.distance_metres or 0))
        return hits, hyb_resp.body
    except Exception:
        sem_body: dict[str, Any] = {
            "size": size,
            "query": {
                "bool": {
                    "must": [{"semantic": {"field": "searchable_content", "query": query}}],
                    "filter": filters,
                }
            },
        }
        if lat is not None and lon is not None:
            sem_body["sort"] = [{"_geo_distance": {"location": {"lat": lat, "lon": lon}, "order": "asc", "unit": "m"}}]
        hyb_resp = es.search(index=CORPUS_INDEX, body=sem_body)
        return _parse_hits(hyb_resp.body, reason_prefix), hyb_resp.body


def compare_text_es(
    query: str,
    lat: float | None = None,
    lon: float | None = None,
    radius_m: int | None = None,
    doc_types: list[str] | None = None,
    dietary: list[str] | None = None,
    size: int = 10,
) -> CompareResponse:
    if not es_configured():
        return _local_compare(query, lat, lon, radius_m, doc_types, dietary, size)

    from api.services.inference import embed_text, embed_text_oss

    es = _client()
    geo = {"lat": lat, "lon": lon, "radius_m": radius_m} if lat is not None and lon is not None else None
    filters = _build_es_filters(doc_types, dietary, geo)

    fetch = min(size * 4, 50)

    t0 = time.time()
    lex_hits, lex_resp = _lexical_search(es, query, filters, lat, lon, fetch)
    lex_hits = _normalize_result_hits(lex_hits, size)
    t1 = time.time()

    oss_hits: list[Hit] = []
    oss_total = 0
    oss_message: str | None = None
    oss_unsupported = False
    try:
        oss_vector = embed_text_oss(query, query=True)
        oss_hits, oss_resp = _hybrid_rrf(
            es, query, oss_vector, "embedding_oss", filters, fetch, "hybrid-oss", lat, lon
        )
        oss_hits = _normalize_result_hits(oss_hits, size)
        oss_total = len(oss_hits)
    except Exception as exc:
        oss_unsupported = True
        oss_message = f"E5 hybrid unavailable — run setup_inference_oss.py and backfill_embeddings.py ({exc})"
    t2 = time.time()

    jina_vector = embed_text(query, task="retrieval.query")
    jina_hits, jina_resp = _hybrid_rrf(
        es, query, jina_vector, "embedding", filters, fetch, "hybrid-jina", lat, lon
    )
    jina_hits = _normalize_result_hits(jina_hits, size)
    t3 = time.time()

    return CompareResponse(
        query=query,
        mode="text",
        lexical=SearchSide(
            hits=lex_hits,
            total=len(lex_hits),
            took_ms=int((t1 - t0) * 1000),
        ),
        hybrid_oss=SearchSide(
            hits=oss_hits,
            total=oss_total,
            took_ms=int((t2 - t1) * 1000),
            unsupported=oss_unsupported,
            message=oss_message,
        ),
        hybrid_jina=SearchSide(
            hits=jina_hits,
            total=len(jina_hits),
            took_ms=int((t3 - t2) * 1000),
        ),
        diff=_build_diff(lex_hits, oss_hits, jina_hits),
    )


def _strip_catalog_dish_image(hit: Hit) -> Hit:
    """Venue hits use shared /assets/food/* JPGs — hide on photo results so cards read as restaurants."""
    url = hit.hero_image_url or ""
    if url.startswith("/assets/food/"):
        hit.hero_image_url = None
    return hit


def _venue_display_name(title: str) -> str:
    return title.split("—")[0].strip() or title


def _dedupe_hits(hits: list[Hit]) -> list[Hit]:
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    out: list[Hit] = []
    for h in hits:
        if h.doc_id in seen_ids:
            continue
        name_key = _venue_display_name(h.title).lower()
        if name_key in seen_names:
            continue
        seen_ids.add(h.doc_id)
        seen_names.add(name_key)
        out.append(h)
    return out


def _normalize_result_hits(hits: list[Hit], size: int) -> list[Hit]:
    """One row per venue name; title is the restaurant name only."""
    out: list[Hit] = []
    for i, h in enumerate(_dedupe_hits(hits)[:size]):
        h.title = _venue_display_name(h.title)
        h.rank = i + 1
        out.append(h)
    return out


def _dish_text_proxy(dish_id: str) -> str | None:
    manifest_path = DATA_DIR / "dish_image_manifest.json"
    if not manifest_path.exists():
        return None
    manifest = json.loads(manifest_path.read_text())
    for item in manifest:
        if item.get("dish_id") == dish_id:
            return item.get("dish_name") or item.get("search_text")
    return None


def _infer_dish_from_image(es, vector: list[float]) -> str | None:
    """Use dish_image catalog internally to label the photo — never returned to clients."""
    try:
        resp = es.search(
            index=CORPUS_INDEX,
            body={
                "size": 1,
                "knn": {
                    "field": "embedding",
                    "query_vector": vector,
                    "k": 1,
                    "num_candidates": 40,
                    "filter": [{"term": {"doc_type": "dish_image"}}],
                },
            },
        )
        hits = resp.body.get("hits", {}).get("hits", [])
        if hits:
            return hits[0].get("_source", {}).get("dish_id")
    except Exception:
        pass
    return None


def _rerank_photo_venue_hits(hits: list[Hit], inferred_dish: str | None) -> list[Hit]:
    if not inferred_dish:
        return hits

    def sort_key(h: Hit) -> float:
        base = h.score or 0.0
        if h.dish_id == inferred_dish:
            return base + 10.0
        return base

    return sorted(hits, key=sort_key, reverse=True)


def _finalize_photo_hits(hits: list[Hit], label: str, inferred_dish: str | None = None, size: int = 10) -> list[Hit]:
    prepared: list[Hit] = []
    for h in _dedupe_hits(hits):
        h = _strip_catalog_dish_image(h)
        venue = _venue_display_name(h.title)
        h.title = venue
        dish = h.signature_dish or "similar food"
        if inferred_dish and h.dish_id == inferred_dish:
            h.match_reason = f"visual: Jina multimodal — {venue}"
        else:
            h.match_reason = f"visual: Jina multimodal — {venue}"
        prepared.append(h)
    return _normalize_result_hits(prepared, size)


def compare_image(
    image_base64: str | None = None,
    dish_id: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_m: int | None = None,
    size: int = 10,
) -> CompareResponse:
    from api.config import ASSETS_FOOD
    from api.services.inference import embed_image_base64, embed_text_oss, file_to_data_uri

    if dish_id and not image_base64:
        path = ASSETS_FOOD / f"{dish_id}.jpg"
        if not path.exists():
            raise FileNotFoundError(f"No image for dish_id={dish_id}")
        image_base64 = file_to_data_uri(path)

    if not image_base64:
        raise ValueError("image_base64 or dish_id required")

    label = dish_id or "uploaded photo"

    if not es_configured():
        docs = _geo_filter_docs(_venue_filter(None, None), lat, lon, radius_m)
        proxy = (_dish_text_proxy(dish_id) or dish_id.replace("_", " ")) if dish_id else "food dish"
        scored = sorted(
            (
                (
                    max(_lexical_score(proxy, d) * 0.3, 0) + _semantic_score(proxy, d, weight_vibes=2.0),
                    d,
                )
                for d in docs
            ),
            key=lambda x: -x[0],
        )
        jina_hits = _finalize_photo_hits(
            _rerank_photo_venue_hits(
                [_doc_to_hit(d, s, 0, "") for s, d in scored[: size * 3] if s > 0],
                dish_id,
            ),
            label,
            dish_id,
            size,
        )
        oss_hits: list[Hit] = []
        if dish_id:
            oss_scored = sorted(
                (
                    (
                        max(_lexical_score(proxy, d) * 0.4, 0) + _semantic_score(proxy, d, weight_vibes=1.2),
                        d,
                    )
                    for d in docs
                ),
                key=lambda x: -x[0],
            )
            oss_hits = _normalize_result_hits(
                [
                    _strip_catalog_dish_image(_doc_to_hit(d, s, i + 1, f"oss-semantic: {proxy}"))
                    for i, (s, d) in enumerate(oss_scored[: size * 3])
                    if s > 0
                ],
                size,
            )
        oss_side = SearchSide(
            hits=oss_hits,
            total=len(oss_hits),
            took_ms=3 if oss_hits else 0,
            unsupported=not dish_id,
            message=None if dish_id else "Open-source E5 is text-only — pick a gallery dish or use text search",
        )
        return CompareResponse(
            query=f"[photo:{label}]",
            mode="photo",
            lexical=SearchSide(
                hits=[],
                total=0,
                took_ms=0,
                unsupported=True,
                message="Lexical search cannot match images — 0 venue results",
            ),
            hybrid_oss=oss_side,
            hybrid_jina=SearchSide(hits=jina_hits, total=len(jina_hits), took_ms=5),
            diff=_build_diff([], oss_hits, jina_hits),
        )

    es = _client()
    geo = {"lat": lat, "lon": lon, "radius_m": radius_m} if lat is not None and lon is not None else None
    # kNN over all venues — dish_image catalog docs excluded; no dish_id filter (full-index multimodal search)
    venue_filters = _build_es_filters(None, None, geo, venues_only=True)

    from api.services.embedding_cache import get_dish_image_embedding, set_dish_image_embedding

    t0 = time.time()
    vector: list[float] | None = None
    if dish_id:
        vector = get_dish_image_embedding(dish_id)
    if vector is None:
        vector = embed_image_base64(image_base64, task="retrieval.query")
        if dish_id:
            set_dish_image_embedding(dish_id, vector)
    inferred_dish = dish_id or _infer_dish_from_image(es, vector)
    fetch_size = 50
    knn_body: dict[str, Any] = {
        "size": fetch_size,
        "knn": {
            "field": "embedding",
            "query_vector": vector,
            "k": fetch_size,
            "num_candidates": max(fetch_size * 20, 200),
            "filter": venue_filters,
        },
    }
    if lat is not None and lon is not None:
        knn_body["sort"] = [{"_geo_distance": {"location": {"lat": lat, "lon": lon}, "order": "asc", "unit": "m"}}]
    try:
        jina_resp = es.search(index=CORPUS_INDEX, body=knn_body)
        raw_hits = _parse_hits(jina_resp.body, "visual")
    except Exception:
        sem_body: dict[str, Any] = {
            "size": fetch_size,
            "query": {
                "bool": {
                    "must": [{"semantic": {"field": "searchable_content", "query": image_base64}}],
                    "filter": venue_filters,
                }
            },
        }
        if lat is not None and lon is not None:
            sem_body["sort"] = [{"_geo_distance": {"location": {"lat": lat, "lon": lon}, "order": "asc", "unit": "m"}}]
        jina_resp = es.search(index=CORPUS_INDEX, body=sem_body)
        raw_hits = _parse_hits(jina_resp.body, "visual")
    jina_hits = _finalize_photo_hits(
        _rerank_photo_venue_hits(raw_hits, inferred_dish),
        label,
        inferred_dish,
        size,
    )
    t1 = time.time()

    # E5 column: semantic kNN on embedding_oss only (text proxy when gallery dish picked)
    oss_hits: list[Hit] = []
    oss_total = 0
    oss_took = 0
    oss_unsupported = True
    oss_message = "Open-source E5 is text-only — pick a gallery dish or use text search"
    if dish_id:
        proxy = _dish_text_proxy(dish_id) or dish_id.replace("_", " ")
        t2 = time.time()
        try:
            oss_vector = embed_text_oss(proxy, query=True)
            raw_oss, oss_resp = _knn_search(
                es, oss_vector, "embedding_oss", venue_filters, fetch_size, "oss-semantic", lat, lon
            )
            oss_hits = _normalize_result_hits(
                [_strip_catalog_dish_image(h) for h in raw_oss],
                size,
            )
            for h in oss_hits:
                h.match_reason = f"oss-semantic: E5 · {h.title}"
            oss_total = len(oss_hits)
            oss_took = int((time.time() - t2) * 1000)
            oss_unsupported = False
            oss_message = f"E5 semantic (text proxy: {proxy})"
        except Exception:
            oss_hits = []
            oss_message = "OSS embedding unavailable — check INFERENCE_ENDPOINT_OSS_ID"

    return CompareResponse(
        query=f"[photo:{label}]",
        mode="photo",
        lexical=SearchSide(
            hits=[],
            total=0,
            took_ms=0,
            unsupported=True,
            message="Lexical search cannot match images — 0 venue results",
        ),
        hybrid_oss=SearchSide(
            hits=oss_hits,
            total=oss_total,
            took_ms=oss_took,
            unsupported=oss_unsupported,
            message=oss_message if oss_unsupported or dish_id else None,
        ),
        hybrid_jina=SearchSide(
            hits=jina_hits,
            total=len(jina_hits),
            took_ms=int((t1 - t0) * 1000),
        ),
        diff=_build_diff([], oss_hits, jina_hits),
    )


def _graph_doc_to_hit(doc: dict, reason: str) -> Hit | None:
    if not doc.get("location"):
        return None
    return Hit(
        doc_id=doc["doc_id"],
        title=doc.get("title", ""),
        doc_type=doc.get("doc_type", ""),
        venue_tier=doc.get("venue_tier"),
        signature_dish=doc.get("signature_dish"),
        dish_id=doc.get("dish_id"),
        hawker_centre=doc.get("hawker_centre"),
        neighbourhood=doc.get("neighbourhood") or doc.get("planning_area"),
        location=doc["location"],
        hero_image_url=doc.get("hero_image_url"),
        rating=doc.get("rating"),
        price_range=doc.get("price_range"),
        match_reason=reason,
    )


def _local_expand_hop(
    source: dict,
    all_docs: list[dict],
    exclude: set[str],
    limit_per_type: int,
    hop: int,
) -> tuple[list[GraphEdge], dict[str, Hit]]:
    source_id = source["doc_id"]
    edges: list[GraphEdge] = []
    nodes: dict[str, Hit] = {}
    dish_id = source.get("dish_id")
    hawker = source.get("hawker_centre")

    if dish_id:
        peers = [
            d
            for d in all_docs
            if d.get("dish_id") == dish_id and d.get("doc_id") not in exclude and d.get("doc_id") != source_id
        ]
        for peer in peers[:limit_per_type]:
            hit = _graph_doc_to_hit(peer, f"hop {hop} · same dish")
            if hit:
                nodes[hit.doc_id] = hit
                edges.append(
                    GraphEdge(
                        source_id=source_id,
                        target_id=hit.doc_id,
                        edge_type="same_dish",
                        label=f"Same dish · {source.get('signature_dish', dish_id)}",
                        es_pattern="term filter on dish_id",
                        hop=hop,
                    )
                )

    if hawker and hop == 1:
        peers = [
            d
            for d in all_docs
            if d.get("hawker_centre") == hawker and d.get("doc_id") not in exclude and d.get("doc_id") != source_id
        ]
        for peer in peers[:limit_per_type]:
            if peer["doc_id"] in nodes:
                continue
            hit = _graph_doc_to_hit(peer, f"hop {hop} · same hawker")
            if hit:
                nodes[hit.doc_id] = hit
                edges.append(
                    GraphEdge(
                        source_id=source_id,
                        target_id=hit.doc_id,
                        edge_type="same_hawker",
                        label=f"Same hawker · {hawker}",
                        es_pattern="term on hawker_centre.keyword",
                        hop=hop,
                    )
                )

    return edges, nodes


def _local_venue_graph(doc_id: str, hops: int = 2, limit_per_type: int = 2, max_branches: int = 3) -> VenueGraphResponse:
    t0 = time.time()
    docs = _venue_filter(None, None)
    by_id = {d["doc_id"]: d for d in docs}
    center = by_id.get(doc_id)
    if not center:
        return VenueGraphResponse(center_id=doc_id, summary="Venue not found")

    edges: list[GraphEdge] = []
    nodes_by_id: dict[str, Hit] = {}
    seen: set[str] = {doc_id}

    hop1_edges, hop1_nodes = _local_expand_hop(center, docs, seen, limit_per_type, hop=1)
    edges.extend(hop1_edges)
    nodes_by_id.update(hop1_nodes)
    seen.update(hop1_nodes.keys())

    if hops >= 2 and hop1_nodes:
        for branch_id in list(hop1_nodes.keys())[:max_branches]:
            branch = by_id.get(branch_id)
            if not branch:
                continue
            hop2_edges, hop2_nodes = _local_expand_hop(branch, docs, seen, max(1, limit_per_type - 1), hop=2)
            edges.extend(hop2_edges)
            nodes_by_id.update(hop2_nodes)
            seen.update(hop2_nodes.keys())

    hop1_n = sum(1 for e in edges if e.hop == 1)
    hop2_n = sum(1 for e in edges if e.hop == 2)
    summary = f"{len(edges)} edges · hop-1: {hop1_n} · hop-2: {hop2_n} (term traversals)"
    return VenueGraphResponse(
        center_id=doc_id,
        edges=edges,
        nodes=list(nodes_by_id.values()),
        took_ms=int((time.time() - t0) * 1000),
        summary=summary,
        engine="structural",
        es_api="term filters on dish_id + hawker_centre.keyword (Serverless-compatible)",
    )


def _es_expand_hop(
    es,
    source: dict,
    source_id: str,
    venue_filters: list[dict],
    exclude: set[str],
    limit_per_type: int,
    hop: int,
) -> tuple[list[GraphEdge], dict[str, Hit]]:
    edges: list[GraphEdge] = []
    nodes: dict[str, Hit] = {}
    must_not = [{"ids": {"values": list(exclude | {source_id})}}]

    dish_id = source.get("dish_id")
    if dish_id:
        resp = es.search(
            index=CORPUS_INDEX,
            body={
                "size": limit_per_type,
                "query": {
                    "bool": {
                        "filter": venue_filters + [{"term": {"dish_id": dish_id}}],
                        "must_not": must_not,
                    }
                },
            },
        )
        for h in _parse_hits(resp.body, f"graph hop {hop} · dish"):
            nodes[h.doc_id] = h
            edges.append(
                GraphEdge(
                    source_id=source_id,
                    target_id=h.doc_id,
                    edge_type="same_dish",
                    label=f"Same dish · {source.get('signature_dish', dish_id)}",
                    es_pattern="GET /_search → term dish_id",
                    hop=hop,
                )
            )

    hawker = source.get("hawker_centre")
    if hawker and hop == 1:
        resp = es.search(
            index=CORPUS_INDEX,
            body={
                "size": limit_per_type,
                "query": {
                    "bool": {
                        "filter": venue_filters + [{"term": {"hawker_centre.keyword": hawker}}],
                        "must_not": must_not + [{"ids": {"values": list(nodes.keys())}}],
                    }
                },
            },
        )
        for h in _parse_hits(resp.body, f"graph hop {hop} · hawker"):
            if h.doc_id in nodes:
                continue
            nodes[h.doc_id] = h
            edges.append(
                GraphEdge(
                    source_id=source_id,
                    target_id=h.doc_id,
                    edge_type="same_hawker",
                    label=f"Same hawker · {hawker}",
                    es_pattern="GET /_search → term hawker_centre.keyword",
                    hop=hop,
                )
            )

    return edges, nodes


def _graph_api_unavailable(exc: Exception) -> bool:
    code = getattr(exc, "status_code", None)
    if code == 410:
        return True
    body = getattr(exc, "body", None) or getattr(exc, "info", None)
    text = f"{exc} {body}".lower()
    return "api_not_available" in text or "serverless" in text


def _edge_type_for_field(field: str) -> str:
    if field == "dish_id":
        return "same_dish"
    if field.startswith("hawker_centre"):
        return "same_hawker"
    return "graph_explore"


def _venues_for_graph_term(
    es,
    field: str,
    term: str,
    venue_filters: list[dict],
    exclude: set[str],
    limit: int,
) -> list[Hit]:
    term_filter: dict[str, Any] = (
        {"term": {"dietary_tags": term}} if field == "dietary_tags" else {"term": {field: term}}
    )
    resp = es.search(
        index=CORPUS_INDEX,
        body={
            "size": limit,
            "query": {
                "bool": {
                    "filter": venue_filters + [term_filter],
                    "must_not": [{"ids": {"values": list(exclude)}}],
                }
            },
        },
    )
    return _parse_hits(resp.body, f"graph explore · {field}")


def _es_graph_explore_venue_graph(
    doc_id: str,
    hops: int = 2,
    limit_per_type: int = 2,
) -> VenueGraphResponse | None:
    """POST /{index}/_graph/explore — not available on Elastic Serverless (410)."""
    t0 = time.time()
    es = _client()
    venue_filters = _build_es_filters(None, None, None, venues_only=True)

    try:
        es.get(index=CORPUS_INDEX, id=doc_id)
    except Exception:
        return VenueGraphResponse(
            center_id=doc_id,
            summary="Venue not found in index",
            engine="explore",
            es_api=f"POST /{CORPUS_INDEX}/_graph/explore",
        )

    try:
        raw = es.graph.explore(
            index=CORPUS_INDEX,
            query={"ids": {"values": [doc_id]}},
            vertices=[
                {"field": "dish_id", "size": limit_per_type + 3, "min_doc_count": 1},
                {"field": "hawker_centre.keyword", "size": limit_per_type + 3, "min_doc_count": 1},
            ],
            connections={
                "vertices": [
                    {"field": "dish_id", "size": 10, "min_doc_count": 1},
                    {"field": "hawker_centre.keyword", "size": 10, "min_doc_count": 1},
                    {"field": "neighbourhood.keyword", "size": 8, "min_doc_count": 1},
                    {"field": "dietary_tags", "size": 6, "min_doc_count": 1},
                ]
            },
            controls={"use_significance": True, "sample_size": 500, "timeout": 4000},
        )
    except Exception as exc:
        if _graph_api_unavailable(exc):
            return None
        raise

    edges: list[GraphEdge] = []
    nodes_by_id: dict[str, Hit] = {}
    seen: set[str] = {doc_id}
    explore_vertices = raw.get("vertices") or []

    for vtx in sorted(explore_vertices, key=lambda v: (-(v.get("weight") or 0), v.get("depth", 0))):
        depth = int(vtx.get("depth") or 0)
        if depth < 1 or depth > hops:
            continue
        field = str(vtx.get("field") or "")
        term = str(vtx.get("term") or "")
        if not field or not term:
            continue
        edge_type = _edge_type_for_field(field)
        label_field = field.replace(".keyword", "")
        for hit in _venues_for_graph_term(es, field, term, venue_filters, seen, limit_per_type):
            if hit.doc_id in seen:
                continue
            seen.add(hit.doc_id)
            nodes_by_id[hit.doc_id] = hit
            weight = vtx.get("weight")
            weight_note = f" · weight {weight:.3f}" if isinstance(weight, (int, float)) else ""
            edges.append(
                GraphEdge(
                    source_id=doc_id,
                    target_id=hit.doc_id,
                    edge_type=edge_type,  # type: ignore[arg-type]
                    label=f"Graph explore · {label_field}={term}{weight_note}",
                    es_pattern=f"POST /{CORPUS_INDEX}/_graph/explore → {field}:{term}",
                    hop=depth,
                )
            )

    hop1_n = sum(1 for e in edges if e.hop == 1)
    hop2_n = sum(1 for e in edges if e.hop == 2)
    summary = (
        f"{len(edges)} edges · hop-1: {hop1_n} · hop-2: {hop2_n} · "
        f"Elasticsearch Graph explore ({len(explore_vertices)} vertices)"
    )
    return VenueGraphResponse(
        center_id=doc_id,
        edges=edges,
        nodes=list(nodes_by_id.values()),
        took_ms=int((time.time() - t0) * 1000),
        summary=summary,
        engine="explore",
        es_api=f"POST /{CORPUS_INDEX}/_graph/explore",
    )


def _structural_venue_graph(
    doc_id: str,
    hops: int = 2,
    limit_per_type: int = 2,
    max_branches: int = 3,
) -> VenueGraphResponse:
    t0 = time.time()
    es = _client()
    venue_filters = _build_es_filters(None, None, None, venues_only=True)

    try:
        center = es.get(index=CORPUS_INDEX, id=doc_id).body.get("_source", {})
    except Exception:
        return VenueGraphResponse(
            center_id=doc_id,
            summary="Venue not found in index",
            engine="structural",
            es_api="term filters on dish_id + hawker_centre.keyword",
        )

    edges: list[GraphEdge] = []
    nodes_by_id: dict[str, Hit] = {}
    seen: set[str] = {doc_id}
    docs_by_id: dict[str, dict] = {doc_id: center}

    hop1_edges, hop1_nodes = _es_expand_hop(es, center, doc_id, venue_filters, seen, limit_per_type, hop=1)
    edges.extend(hop1_edges)
    nodes_by_id.update(hop1_nodes)
    seen.update(hop1_nodes.keys())

    if hops >= 2 and hop1_nodes:
        branch_ids = list(hop1_nodes.keys())[:max_branches]
        if branch_ids:
            mget = es.mget(index=CORPUS_INDEX, body={"ids": branch_ids})
            for doc in mget.body.get("docs", []):
                if doc.get("found"):
                    docs_by_id[doc["_id"]] = doc["_source"]

        hop2_limit = max(1, limit_per_type - 1)
        for branch_id in branch_ids:
            branch = docs_by_id.get(branch_id)
            if not branch:
                continue
            hop2_edges, hop2_nodes = _es_expand_hop(
                es, branch, branch_id, venue_filters, seen, hop2_limit, hop=2
            )
            edges.extend(hop2_edges)
            nodes_by_id.update(hop2_nodes)
            seen.update(hop2_nodes.keys())

    hop1_n = sum(1 for e in edges if e.hop == 1)
    hop2_n = sum(1 for e in edges if e.hop == 2)
    summary = f"{len(edges)} edges · hop-1: {hop1_n} · hop-2: {hop2_n} · structural term hops (Serverless)"
    return VenueGraphResponse(
        center_id=doc_id,
        edges=edges,
        nodes=list(nodes_by_id.values()),
        took_ms=int((time.time() - t0) * 1000),
        summary=summary,
        engine="structural",
        es_api="term filters on dish_id + hawker_centre.keyword (Serverless fallback)",
    )


def venue_graph(
    doc_id: str,
    hops: int = 2,
    limit_per_type: int = 2,
    max_branches: int = 3,
    engine: str = "auto",
) -> VenueGraphResponse:
    if not es_configured():
        return _local_venue_graph(doc_id, hops, limit_per_type, max_branches)

    if engine in ("auto", "explore"):
        explored = _es_graph_explore_venue_graph(doc_id, hops=hops, limit_per_type=limit_per_type)
        if explored is not None:
            return explored
        if engine == "explore":
            return VenueGraphResponse(
                center_id=doc_id,
                summary="Graph explore API unavailable on Serverless — use engine=structural",
                engine="explore",
                es_api=f"POST /{CORPUS_INDEX}/_graph/explore",
            )

    return _structural_venue_graph(doc_id, hops, limit_per_type, max_branches)


def create_case(payload: dict) -> dict:
    import uuid
    from datetime import datetime, timezone

    case_id = str(uuid.uuid4())
    doc = {
        "case_id": case_id,
        "title": payload["title"],
        "user_query": payload["user_query"],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "shortlist": payload.get("shortlist", []),
        "anchor_location": payload.get("anchor_location"),
        "search_radius_metres": payload.get("search_radius_metres"),
        "dietary_tags": payload.get("dietary_tags", []),
        "agent_notes": payload.get("agent_notes"),
        "semantic_summary": payload.get("user_query", ""),
    }
    if es_configured():
        es = _client()
        es.index(index=CASES_INDEX, id=case_id, document=doc)
    else:
        path = DATA_DIR / "local_cases.jsonl"
        with path.open("a") as f:
            f.write(json.dumps(doc) + "\n")
    return {"case_id": case_id, "index": CASES_INDEX}
