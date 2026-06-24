#!/usr/bin/env python3
"""Verify Serverless Search project connectivity and write .env template hints."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

REQUIRED = ["ELASTICSEARCH_URL", "ES_API_KEY"]
INFERENCE_DEFAULT = ".jina-embeddings-v5-omni-small"


def main() -> int:
    missing = [k for k in REQUIRED if not os.getenv(k)]
    if missing:
        print("Missing environment variables:", ", ".join(missing))
        print("\nCreate a Serverless Search project at https://cloud.elastic.co")
        print("1. Create project → Search")
        print("2. Copy Elasticsearch endpoint + API key into sg-food-search-demo/.env")
        print(f"3. Set INFERENCE_ENDPOINT_ID={INFERENCE_DEFAULT}")
        return 1

    from elasticsearch import Elasticsearch

    es = Elasticsearch(
        os.environ["ELASTICSEARCH_URL"],
        api_key=os.environ["ES_API_KEY"],
        request_timeout=30,
    )
    info = es.info()
    print("Connected to Elasticsearch", info.body.get("cluster_name", ""))
    print("Version:", info.body.get("version", {}).get("number", "unknown"))

    inference_id = os.getenv("INFERENCE_ENDPOINT_ID", INFERENCE_DEFAULT)
    try:
        resp = es.perform_request("GET", f"/_inference/{inference_id}")
        print(f"Inference endpoint OK: {inference_id}")
        print("  task_type:", resp.body.get("task_type"))
        print("  service:", resp.body.get("service"))
    except Exception as exc:
        print(f"Warning: could not verify inference endpoint {inference_id}: {exc}")
        print("Ensure EIS Jina v5 omni is available on your Search project.")

    kibana = os.getenv("KIBANA_URL")
    if kibana:
        print("Kibana URL:", kibana)
    else:
        print("Optional: set KIBANA_URL for Agent Builder setup")

    print("\nNext steps:")
    print("  python scripts/generate_synthetic_data.py")
    print("  python scripts/setup_indices.py")
    print("  python scripts/ingest_corpus.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
