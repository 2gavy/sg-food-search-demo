#!/usr/bin/env python3
"""Create Elasticsearch indices with semantic_text + DiskBBQ mappings."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.config import (
    CASES_INDEX,
    CORPUS_INDEX,
    CORPUS_INDEX_VERSIONED,
    ELASTICSEARCH_URL,
    ES_API_KEY,
    INFERENCE_ENDPOINT_ID,
    EMBEDDING_DIMS,
    EMBEDDING_OSS_DIMS,
)
from elasticsearch import Elasticsearch


def get_client() -> Elasticsearch:
    if not ELASTICSEARCH_URL or not ES_API_KEY:
        raise SystemExit("Set ELASTICSEARCH_URL and ES_API_KEY in .env")
    return Elasticsearch(ELASTICSEARCH_URL, api_key=ES_API_KEY, request_timeout=60)


def corpus_mapping() -> dict:
    return {
        "mappings": {
            "properties": {
                "doc_id": {"type": "keyword"},
                "title": {"type": "text"},
                "description": {"type": "text"},
                "doc_type": {"type": "keyword"},
                "venue_tier": {"type": "keyword"},
                "signature_dish": {"type": "text"},
                "dish_id": {"type": "keyword"},
                "cuisine": {"type": "keyword"},
                "hawker_centre": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "neighbourhood": {"type": "keyword"},
                "planning_area": {"type": "keyword"},
                "nearest_mrt": {"type": "keyword"},
                "price_range": {"type": "keyword"},
                "rating": {"type": "float"},
                "review_count": {"type": "integer"},
                "estimated_delivery_mins": {"type": "integer"},
                "dietary_tags": {"type": "keyword"},
                "opening_hours": {"type": "keyword"},
                "vibes": {"type": "keyword"},
                "address": {"type": "text"},
                "postal_code": {"type": "keyword"},
                "hero_image_url": {"type": "keyword", "index": False},
                "media_type": {"type": "keyword"},
                "map_visible": {"type": "boolean"},
                "related_venue_ids": {"type": "keyword"},
                "location": {"type": "geo_point"},
                "hawker_centre_location": {"type": "geo_point"},
                "searchable_content": {
                    "type": "semantic_text",
                    "inference_id": INFERENCE_ENDPOINT_ID,
                },
                "embedding": {
                    "type": "dense_vector",
                    "dims": EMBEDDING_DIMS,
                    "index": True,
                    "similarity": "dot_product",
                    "index_options": {"type": "bbq_disk"},
                },
                "embedding_oss": {
                    "type": "dense_vector",
                    "dims": EMBEDDING_OSS_DIMS,
                    "index": True,
                    "similarity": "dot_product",
                    "index_options": {"type": "bbq_disk"},
                },
                "embedding_clustering": {
                    "type": "dense_vector",
                    "dims": EMBEDDING_DIMS,
                    "index": True,
                    "similarity": "dot_product",
                    "index_options": {"type": "bbq_disk"},
                },
            }
        },
    }


def cases_mapping() -> dict:
    return {
        "mappings": {
            "properties": {
                "case_id": {"type": "keyword"},
                "title": {"type": "text"},
                "user_query": {"type": "text"},
                "status": {"type": "keyword"},
                "created_at": {"type": "date"},
                "neighbourhood": {"type": "keyword"},
                "dietary_tags": {"type": "keyword"},
                "agent_notes": {"type": "text"},
                "anchor_location": {"type": "geo_point"},
                "search_radius_metres": {"type": "integer"},
                "semantic_summary": {
                    "type": "semantic_text",
                    "inference_id": INFERENCE_ENDPOINT_ID,
                },
                "shortlist": {
                    "type": "nested",
                    "properties": {
                        "doc_id": {"type": "keyword"},
                        "title": {"type": "text"},
                        "doc_type": {"type": "keyword"},
                        "match_reason": {"type": "text"},
                        "location": {"type": "geo_point"},
                    },
                },
            }
        },
    }


def recreate_index(es: Elasticsearch, index: str, body: dict) -> None:
    if es.indices.exists(index=index):
        es.indices.delete(index=index)
        print(f"Deleted {index}")
    es.indices.create(index=index, body=body)
    print(f"Created {index}")


def main() -> None:
    es = get_client()
    recreate_index(es, CORPUS_INDEX_VERSIONED, corpus_mapping())
    recreate_index(es, CASES_INDEX, cases_mapping())

    actions = {"actions": [{"add": {"index": CORPUS_INDEX_VERSIONED, "alias": CORPUS_INDEX}}]}
    es.indices.update_aliases(body=actions)
    print(f"Alias {CORPUS_INDEX} -> {CORPUS_INDEX_VERSIONED}")


if __name__ == "__main__":
    main()
