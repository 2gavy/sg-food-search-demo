#!/usr/bin/env python3
"""Verify or create multilingual-e5-small inference endpoint on Serverless Search."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.config import ELASTICSEARCH_URL, ES_API_KEY, INFERENCE_ENDPOINT_OSS_ID
from elasticsearch import Elasticsearch


def main() -> None:
    if not ELASTICSEARCH_URL or not ES_API_KEY:
        raise SystemExit("Set ELASTICSEARCH_URL and ES_API_KEY in .env")

    es = Elasticsearch(ELASTICSEARCH_URL, api_key=ES_API_KEY, request_timeout=120)
    try:
        resp = es.perform_request("GET", f"/_inference/{INFERENCE_ENDPOINT_OSS_ID}")
        body = resp.body
        print(f"OK: {INFERENCE_ENDPOINT_OSS_ID}")
        print("  service:", body.get("service"))
        print("  task_type:", body.get("task_type"))
        settings = body.get("service_settings", {})
        print("  model_id:", settings.get("model_id"))
        print("  dimensions:", settings.get("dimensions"))
        return
    except Exception as exc:
        print(f"Could not find {INFERENCE_ENDPOINT_OSS_ID}: {exc}")

    print("\nCreating OSS inference endpoint (multilingual-e5-small)…")
    custom_id = INFERENCE_ENDPOINT_OSS_ID.lstrip(".")
    if custom_id == INFERENCE_ENDPOINT_OSS_ID:
        custom_id = "sg-food-e5-small"

    body = {
        "service": "elasticsearch",
        "service_settings": {
            "model_id": ".multilingual-e5-small",
            "num_allocations": 1,
            "num_threads": 1,
        },
    }
    try:
        resp = es.perform_request(
            "PUT",
            f"/_inference/text_embedding/{custom_id}",
            body=body,
        )
        print(f"Created endpoint: {custom_id}")
        print(resp.body)
        print(f"\nSet INFERENCE_ENDPOINT_OSS_ID={custom_id} in .env")
    except Exception as create_exc:
        print(f"Create failed: {create_exc}")
        print("\nManual setup (Kibana Dev Console):")
        print(f"""
PUT _inference/text_embedding/sg-food-e5-small
{{
  "service": "elasticsearch",
  "service_settings": {{
    "model_id": ".multilingual-e5-small",
    "num_allocations": 1,
    "num_threads": 1
  }}
}}
""")
        print("Then set INFERENCE_ENDPOINT_OSS_ID=sg-food-e5-small in .env")
        raise SystemExit(1) from create_exc


if __name__ == "__main__":
    main()
