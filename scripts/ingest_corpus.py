#!/usr/bin/env python3
"""Bulk ingest venue documents into Elasticsearch."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.config import CORPUS_INDEX, DATA_DIR, ELASTICSEARCH_URL, ES_API_KEY
from api.services.inference import embed_text, embed_text_oss
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk


def main() -> None:
    if not ELASTICSEARCH_URL or not ES_API_KEY:
        raise SystemExit("Set ELASTICSEARCH_URL and ES_API_KEY in .env")

    es = Elasticsearch(ELASTICSEARCH_URL, api_key=ES_API_KEY, request_timeout=120)
    path = DATA_DIR / "sg_food_corpus.jsonl"
    docs = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

    def actions():
        for i, doc in enumerate(docs):
            body = {k: v for k, v in doc.items() if k != "doc_id"}
            body["doc_id"] = doc["doc_id"]
            text = doc.get("searchable_content", "")
            body["searchable_content"] = text
            try:
                body["embedding"] = embed_text(text, task="retrieval.passage")
                body["embedding_oss"] = embed_text_oss(text, query=False)
                body["embedding_clustering"] = embed_text(text, task="clustering")
            except Exception as exc:
                print(f"Warning: embedding failed for {doc['doc_id']}: {exc}")
            yield {
                "_index": CORPUS_INDEX,
                "_id": doc["doc_id"],
                "_source": body,
            }
            if (i + 1) % 25 == 0:
                print(f"Prepared {i + 1}/{len(docs)}")
                time.sleep(0.2)

    success, errors = bulk(es, actions(), chunk_size=20, request_timeout=120)
    print(f"Ingested {success} documents, errors: {len(errors) if errors else 0}")
    if errors:
        print(errors[:3])


if __name__ == "__main__":
    main()
