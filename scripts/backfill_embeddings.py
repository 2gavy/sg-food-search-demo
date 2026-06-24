#!/usr/bin/env python3
"""Backfill dense_vector fields: Jina (embedding) and OSS E5 (embedding_oss)."""

from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.config import CORPUS_INDEX, ELASTICSEARCH_URL, ES_API_KEY
from api.services.inference import embed_text, embed_text_oss
from elasticsearch import Elasticsearch


def backfill_field(
    es: Elasticsearch,
    *,
    field: str,
    embed_fn,
    label: str,
) -> int:
    resp = es.search(
        index=CORPUS_INDEX,
        body={"size": 500, "query": {"match_all": {}}, "_source": ["doc_id", "searchable_content", field]},
    )
    hits = resp.body["hits"]["hits"]
    updated = 0
    for hit in hits:
        src = hit["_source"]
        if src.get(field):
            continue
        text = src.get("searchable_content", "")
        if not text or (isinstance(text, str) and text.startswith("data:image")):
            continue
        try:
            vector = embed_fn(text if isinstance(text, str) else str(text))
            es.update(index=CORPUS_INDEX, id=hit["_id"], doc={field: vector})
            updated += 1
            if updated % 10 == 0:
                print(f"  {label}: updated {updated}…")
                time.sleep(0.1)
        except Exception as exc:
            print(f"  {label} failed {hit['_id']}: {exc}")
    return updated


def main() -> None:
    if not ELASTICSEARCH_URL or not ES_API_KEY:
        raise SystemExit("Set ELASTICSEARCH_URL and ES_API_KEY in .env")

    es = Elasticsearch(ELASTICSEARCH_URL, api_key=ES_API_KEY, request_timeout=120)
    print("Backfilling Jina embedding…")
    jina = backfill_field(
        es,
        field="embedding",
        embed_fn=lambda t: embed_text(t, task="retrieval.passage"),
        label="Jina",
    )
    print("Backfilling OSS E5 embedding_oss…")
    oss = backfill_field(
        es,
        field="embedding_oss",
        embed_fn=lambda t: embed_text_oss(t, query=False),
        label="E5",
    )
    print(f"Backfill complete: Jina={jina}, OSS={oss}")


if __name__ == "__main__":
    main()
