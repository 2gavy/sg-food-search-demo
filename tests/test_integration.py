"""Optional live Elasticsearch tests — skipped without credentials."""

from __future__ import annotations

import os

import pytest

pytestmark = pytest.mark.integration


def _live_es_configured() -> bool:
    return bool(os.getenv("ELASTICSEARCH_URL") and os.getenv("ES_API_KEY"))


@pytest.fixture
def live_es(monkeypatch):
    if not _live_es_configured():
        pytest.skip("Set ELASTICSEARCH_URL and ES_API_KEY for integration tests")

    import api.config as config
    import api.services.elasticsearch as es_svc

    url = os.environ["ELASTICSEARCH_URL"]
    key = os.environ["ES_API_KEY"]
    monkeypatch.setattr(config, "ELASTICSEARCH_URL", url)
    monkeypatch.setattr(config, "ES_API_KEY", key)
    monkeypatch.setattr(es_svc, "ELASTICSEARCH_URL", url)
    monkeypatch.setattr(es_svc, "ES_API_KEY", key)
    es_svc.LOCAL_CORPUS = None


def test_live_text_compare_three_columns(live_es):
    from api.services.elasticsearch import compare_text_es, es_configured

    assert es_configured() is True
    result = compare_text_es(
        "Warm soupy comfort food near Raffles Place",
        lat=1.2839,
        lon=103.8515,
        radius_m=1200,
        size=5,
    )
    assert result.lexical.total >= 0
    assert result.hybrid_jina.total >= 0


def test_live_photo_compare(live_es):
    from api.services.elasticsearch import compare_image

    result = compare_image(dish_id="chicken_rice", size=5)
    assert result.lexical.unsupported is True
    assert result.hybrid_jina.total > 0
