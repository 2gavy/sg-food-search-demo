"""Shared fixtures — unit tests run in local (no Elasticsearch) mode."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DATA = ROOT / "data"


@pytest.fixture(autouse=True)
def local_mode(request, monkeypatch, tmp_path):
    """Disable ES and use an isolated data directory with a copy of the corpus."""
    if request.node.get_closest_marker("integration"):
        yield
        return

    import api.config as config
    import api.services.elasticsearch as es_svc

    data_dir = tmp_path / "data"
    data_dir.mkdir()
    for name in ("sg_food_corpus.jsonl", "dish_image_manifest.json", "demo_queries.json"):
        src = SOURCE_DATA / name
        if src.exists():
            shutil.copy(src, data_dir / name)

    monkeypatch.setattr(config, "ELASTICSEARCH_URL", "")
    monkeypatch.setattr(config, "ES_API_KEY", "")
    monkeypatch.setattr(config, "DATA_DIR", data_dir)
    monkeypatch.setattr(es_svc, "ELASTICSEARCH_URL", "")
    monkeypatch.setattr(es_svc, "ES_API_KEY", "")
    monkeypatch.setattr(es_svc, "DATA_DIR", data_dir)
    es_svc.LOCAL_CORPUS = None

    yield

    es_svc.LOCAL_CORPUS = None


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    return TestClient(app)
