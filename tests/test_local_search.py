"""Local-mode search (no Elasticsearch) integration tests."""

from __future__ import annotations

import json

import pytest

from api.services.elasticsearch import compare_image, compare_text_es, create_case, es_configured


def test_es_not_configured_in_unit_tests():
    assert es_configured() is False


def test_text_compare_returns_three_columns():
    result = compare_text_es("halal chicken rice comfort", size=5)

    assert result.mode == "text"
    assert result.query == "halal chicken rice comfort"
    assert result.lexical.total >= 0
    assert result.hybrid_oss.total >= 0
    assert result.hybrid_jina.total >= 0
    assert result.hybrid.total == result.hybrid_jina.total


def test_semantic_columns_can_outrank_lexical_only():
    result = compare_text_es("warm soupy comfort food rainy afternoon", size=10)

    jina_ids = {h.doc_id for h in result.hybrid_jina.hits}
    lex_ids = {h.doc_id for h in result.lexical.hits}
    assert len(result.diff.hybrid_only_jina) == len(jina_ids - lex_ids)


def test_geo_filter_reduces_results():
    unfiltered = compare_text_es("laksa", size=20)
    filtered = compare_text_es("laksa", lat=1.2839, lon=103.8515, radius_m=500, size=20)

    assert filtered.lexical.total <= unfiltered.lexical.total
    for hit in filtered.lexical.hits:
        assert hit.distance_metres is not None
        assert hit.distance_metres <= 500


def test_doc_type_filter():
    result = compare_text_es("rice", doc_types=["hawker_stall"], size=10)
    for hit in result.hybrid_jina.hits:
        assert hit.doc_type == "hawker_stall"


def test_photo_compare_lexical_unsupported():
    result = compare_image(dish_id="chicken_rice", size=5)

    assert result.mode == "photo"
    assert result.lexical.unsupported is True
    assert result.lexical.total == 0
    assert result.hybrid_jina.total > 0
    assert result.hybrid_oss.total > 0


def test_photo_compare_returns_venues_not_catalog():
    result = compare_image(dish_id="satay", size=5)

    assert result.hybrid_jina.total > 0
    for hit in result.hybrid_jina.hits:
        assert hit.doc_type != "dish_image"
        assert not hit.doc_id.startswith("dish_image_")
        assert not hit.title.startswith("Dish image:")
        assert hit.hero_image_url is None or not hit.hero_image_url.startswith("/assets/food/")


def test_photo_compare_diverse_venues_not_only_exact_dish():
    result = compare_image(dish_id="satay", size=8)
    titles = {h.title for h in result.hybrid_jina.hits}
    assert len(titles) >= 2

def test_photo_upload_without_dish_id_oss_unsupported():
    result = compare_image(image_base64="data:image/jpeg;base64,abc", size=5)

    assert result.hybrid_oss.unsupported is True
    assert "text-only" in (result.hybrid_oss.message or "").lower()


def test_create_case_local_writes_jsonl(tmp_path, monkeypatch):
    import api.config as config
    import api.services.elasticsearch as es_svc

    data_dir = tmp_path / "data"
    data_dir.mkdir()
    monkeypatch.setattr(config, "DATA_DIR", data_dir)
    monkeypatch.setattr(es_svc, "DATA_DIR", data_dir)

    out = create_case(
        {
            "title": "Test hunt",
            "user_query": "laksa near bugis",
            "shortlist": [{"doc_id": "hawker_002", "title": "Ah Tai", "doc_type": "hawker_stall"}],
        }
    )

    assert "case_id" in out
    cases_path = data_dir / "local_cases.jsonl"
    assert cases_path.exists()
    row = json.loads(cases_path.read_text().strip())
    assert row["title"] == "Test hunt"
    assert row["shortlist"][0]["doc_id"] == "hawker_002"
