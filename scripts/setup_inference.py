#!/usr/bin/env python3
"""Verify Jina v5 omni inference endpoint on Serverless Search."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.config import ELASTICSEARCH_URL, ES_API_KEY, INFERENCE_ENDPOINT_ID
from elasticsearch import Elasticsearch


def main() -> None:
    if not ELASTICSEARCH_URL or not ES_API_KEY:
        raise SystemExit("Set ELASTICSEARCH_URL and ES_API_KEY in .env")

    es = Elasticsearch(ELASTICSEARCH_URL, api_key=ES_API_KEY, request_timeout=30)
    try:
        resp = es.perform_request("GET", f"/_inference/{INFERENCE_ENDPOINT_ID}")
        body = resp.body
        print(f"OK: {INFERENCE_ENDPOINT_ID}")
        print("  service:", body.get("service"))
        print("  task_type:", body.get("task_type"))
        settings = body.get("service_settings", {})
        print("  model_id:", settings.get("model_id"))
        print("  dimensions:", settings.get("dimensions"))
    except Exception as exc:
        print(f"Could not find {INFERENCE_ENDPOINT_ID}: {exc}")
        print("On Serverless Search, EIS endpoints are pre-provisioned.")
        print("Update INFERENCE_ENDPOINT_ID in .env if your project uses a different ID.")
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
