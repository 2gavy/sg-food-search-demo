#!/usr/bin/env python3
"""Remove duplicate venue documents from Elasticsearch (same display name)."""

from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.config import CORPUS_INDEX, ELASTICSEARCH_URL, ES_API_KEY
from elasticsearch import Elasticsearch


def display_name(title: str) -> str:
    return title.split("—")[0].strip()


def main() -> None:
    if not ELASTICSEARCH_URL or not ES_API_KEY:
        raise SystemExit("Set ELASTICSEARCH_URL and ES_API_KEY in .env")

    es = Elasticsearch(ELASTICSEARCH_URL, api_key=ES_API_KEY, request_timeout=120)
    resp = es.search(
        index=CORPUS_INDEX,
        body={
            "size": 500,
            "query": {"bool": {"must_not": [{"terms": {"doc_type": ["dish_image", "food_guide"]}}]}},
            "_source": ["title", "doc_type", "rating", "doc_id"],
        },
    )
    hits = resp.body["hits"]["hits"]
    groups: dict[str, list[dict]] = defaultdict(list)
    for h in hits:
        src = h["_source"]
        key = display_name(src.get("title", "")).lower()
        if not key:
            continue
        groups[key].append(
            {
                "_id": h["_id"],
                "rating": src.get("rating") or 0,
                "doc_type": src.get("doc_type"),
            }
        )

    to_delete: list[str] = []
    for _name, items in groups.items():
        if len(items) <= 1:
            continue
        items.sort(key=lambda x: (-x["rating"], x["_id"]))
        to_delete.extend(i["_id"] for i in items[1:])

    if not to_delete:
        print("No duplicate venue names found.")
        return

    print(f"Deleting {len(to_delete)} duplicate venue documents (keeping best rating per name)…")
    for doc_id in to_delete:
        es.delete(index=CORPUS_INDEX, id=doc_id, ignore=[404])
        print(f"  deleted {doc_id}")

    es.indices.refresh(index=CORPUS_INDEX)
    print("Done.")


if __name__ == "__main__":
    main()
