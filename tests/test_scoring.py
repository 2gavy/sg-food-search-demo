"""Unit tests for local scoring, geo, and diff helpers."""

from __future__ import annotations

from api.models import Hit
from api.services.elasticsearch import (
    _build_diff,
    _haversine_m,
    _lexical_score,
    _semantic_score,
    load_local_corpus,
)


def test_load_local_corpus_has_venues():
    docs = load_local_corpus()
    assert len(docs) >= 200
    assert any(d.get("doc_type") == "hawker_stall" for d in docs)


def test_lexical_score_prefers_title_overlap():
    doc = {
        "title": "Ah Tai — Katong Laksa",
        "description": "Hawker favourite",
        "signature_dish": "Katong Laksa",
        "searchable_content": "laksa spicy",
        "neighbourhood": "Downtown Core",
    }
    assert _lexical_score("laksa", doc) > _lexical_score("satay", doc)


def test_semantic_score_weights_vibes():
    doc = {
        "signature_dish": "Hainanese Chicken Rice",
        "searchable_content": "office lunch",
        "vibes": ["comfort", "light", "clean broth"],
    }
    comfort = _semantic_score("comfort rainy soup", doc, weight_vibes=1.8)
    unrelated = _semantic_score("sushi sashimi", doc, weight_vibes=1.8)
    assert comfort > unrelated


def test_haversine_zero_for_same_point():
    assert _haversine_m(1.28, 103.85, 1.28, 103.85) == 0.0


def test_haversine_reasonable_distance():
    # ~1 km apart in Singapore CBD
    d = _haversine_m(1.2800, 103.8500, 1.2890, 103.8500)
    assert 900 < d < 1100


def test_build_diff_three_columns():
    lexical = [Hit(doc_id="a", title="A", doc_type="hawker_stall", rank=1)]
    oss = [
        Hit(doc_id="a", title="A", doc_type="hawker_stall", rank=1),
        Hit(doc_id="b", title="B", doc_type="hawker_stall", rank=2),
    ]
    jina = [
        Hit(doc_id="a", title="A", doc_type="hawker_stall", rank=1),
        Hit(doc_id="c", title="C", doc_type="hawker_stall", rank=2),
    ]
    diff = _build_diff(lexical, oss, jina)

    assert diff.all_three == ["a"]
    assert diff.hybrid_only_jina == ["c"]
    assert diff.hybrid_only_oss == ["b"]
    assert diff.jina_only == ["c"]
    assert diff.oss_only == ["b"]
    assert diff.hybrid_only == diff.hybrid_only_jina
    assert diff.both == diff.all_three
