#!/usr/bin/env python3
"""Ingest dish image companion documents for multimodal search."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.config import ASSETS_FOOD, CORPUS_INDEX, DATA_DIR, ELASTICSEARCH_URL, ES_API_KEY
from api.services.inference import embed_image_base64, file_to_data_uri
from elasticsearch import Elasticsearch


def main() -> None:
    if not ELASTICSEARCH_URL or not ES_API_KEY:
        print("Skipping ES ingest — no credentials. Local demo mode uses dish_id matching.")
        return

    es = Elasticsearch(ELASTICSEARCH_URL, api_key=ES_API_KEY, request_timeout=120)
    manifest = json.loads((DATA_DIR / "dish_image_manifest.json").read_text())

    for item in manifest:
        dish_id = item["dish_id"]
        path = ASSETS_FOOD / item["image_file"]
        if not path.exists():
            continue
        data_uri = file_to_data_uri(path)
        try:
            vector = embed_image_base64(data_uri, task="retrieval.passage")
        except Exception as exc:
            print(f"Skip {dish_id}: {exc}")
            continue

        doc_id = f"dish_image_{dish_id}"
        body = {
            "doc_id": doc_id,
            "title": f"Dish image: {item['dish_name']}",
            "doc_type": "dish_image",
            "venue_tier": "dish_image",
            "dish_id": dish_id,
            "signature_dish": item["dish_name"],
            "media_type": "image",
            "map_visible": False,
            "related_venue_ids": item.get("venue_doc_ids", []),
            "searchable_content": data_uri,
            "embedding": vector,
            "hero_image_url": f"/assets/food/{item['image_file']}",
            "description": f"Visual reference for {item['dish_name']}",
        }
        es.index(index=CORPUS_INDEX, id=doc_id, document=body)
        print(f"Indexed {doc_id}")

    print("Dish image ingest complete.")


if __name__ == "__main__":
    main()
