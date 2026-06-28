#!/usr/bin/env python3
"""Backfill Jina clustering embeddings (task=clustering) for unsupervised discovery."""

from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.config import CORPUS_INDEX, ELASTICSEARCH_URL, ES_API_KEY
from api.services.inference import embed_text
from elasticsearch import Elasticsearch


def main() -> None:
    if not ELASTICSEARCH_URL or not ES_API_KEY:
        raise SystemExit("Set ELASTICSEARCH_URL and ES_API_KEY in .env")

    es = Elasticsearch(ELASTICSEARCH_URL, api_key=ES_API_KEY, request_timeout=120)

    # Add mapping field if missing (existing indices)
    try:
        es.indices.put_mapping(
            index=CORPUS_INDEX,
            body={
                "properties": {
                    "embedding_clustering": {
                        "type": "dense_vector",
                        "dims": 1024,
                        "index": True,
                        "similarity": "dot_product",
                        "index_options": {"type": "bbq_disk"},
                    }
                }
            },
        )
        print("Ensured embedding_clustering mapping exists")
    except Exception as exc:
        print(f"Mapping note: {exc}")

    resp = es.search(
        index=CORPUS_INDEX,
        body={
            "size": 500,
            "query": {"bool": {"filter": [{"terms": {"doc_type": ["hawker_stall", "restaurant", "cafe", "zi_char"]}}]}},
            "_source": ["doc_id", "searchable_content", "embedding_clustering"],
        },
    )
    updated = 0
    for hit in resp.body["hits"]["hits"]:
        src = hit["_source"]
        if src.get("embedding_clustering"):
            continue
        text = src.get("searchable_content", "")
        if not text or (isinstance(text, str) and text.startswith("data:image")):
            continue
        try:
            vector = embed_text(text if isinstance(text, str) else str(text), task="clustering")
            es.update(index=CORPUS_INDEX, id=hit["_id"], doc={"embedding_clustering": vector})
            updated += 1
            if updated % 10 == 0:
                print(f"  clustering: updated {updated}…")
                time.sleep(0.15)
        except Exception as exc:
            print(f"  failed {hit['_id']}: {exc}")

    print(f"Clustering embedding backfill complete: {updated} documents updated")


if __name__ == "__main__":
    main()
