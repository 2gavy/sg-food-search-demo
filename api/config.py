"""Shared configuration for scripts and API."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "")
ES_API_KEY = os.getenv("ES_API_KEY", "")


def _derive_kibana_url(es_url: str) -> str:
    """Serverless Search: swap .es. host segment for .kb. when KIBANA_URL is omitted."""
    if not es_url:
        return ""
    if ".es." in es_url:
        return es_url.replace(".es.", ".kb.", 1)
    return ""


KIBANA_URL = os.getenv("KIBANA_URL", "") or _derive_kibana_url(ELASTICSEARCH_URL)
KIBANA_API_KEY = os.getenv("KIBANA_API_KEY", "") or ES_API_KEY
INFERENCE_ENDPOINT_ID = os.getenv("INFERENCE_ENDPOINT_ID", ".jina-embeddings-v5-omni-small")
# Open-source contrast model: multilingual E5 (384-dim, Apache 2.0 via HuggingFace)
INFERENCE_ENDPOINT_OSS_ID = os.getenv(
    "INFERENCE_ENDPOINT_OSS_ID", ".multilingual-e5-small-elasticsearch"
)
CORPUS_INDEX = os.getenv("CORPUS_INDEX", "sg_food_corpus_current")
CASES_INDEX = os.getenv("CASES_INDEX", "sg_food_hunt_cases")
AGENT_BUILDER_AGENT_ID = os.getenv("AGENT_BUILDER_AGENT_ID", "sg-food-concierge")
LLM_CONNECTOR_ID = os.getenv("LLM_CONNECTOR_ID", "")
CORPUS_INDEX_VERSIONED = "sg_food_corpus_v1"
DATA_DIR = ROOT / "data"
ASSETS_FOOD = ROOT / "assets" / "food"

EMBEDDING_DIMS = 1024
EMBEDDING_OSS_DIMS = 384
