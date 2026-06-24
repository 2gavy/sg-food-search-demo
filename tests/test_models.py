"""Pydantic model validation tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from api.models import CompareImageRequest, CompareRequest, CompareResponse, GeoFilter, SearchSide


def test_geo_filter_radius_bounds():
    GeoFilter(lat=1.28, lon=103.85, radius_m=1500)
    with pytest.raises(ValidationError):
        GeoFilter(lat=1.28, lon=103.85, radius_m=50)
    with pytest.raises(ValidationError):
        GeoFilter(lat=1.28, lon=103.85, radius_m=20000)


def test_compare_request_size_bounds():
    CompareRequest(query="laksa", size=10)
    with pytest.raises(ValidationError):
        CompareRequest(query="laksa", size=0)
    with pytest.raises(ValidationError):
        CompareRequest(query="laksa", size=100)


def test_compare_response_backward_compat_aliases():
    side = SearchSide(hits=[], total=0, took_ms=1)
    resp = CompareResponse(
        query="test",
        lexical=side,
        hybrid_oss=side,
        hybrid_jina=SearchSide(hits=[], total=3, took_ms=2),
        diff={"hybrid_only_jina": ["a"], "all_three": []},
    )
    assert resp.hybrid.total == 3
    assert resp.diff.hybrid_only == ["a"]
    assert resp.diff.both == resp.diff.all_three


def test_compare_image_accepts_dish_id_only():
    req = CompareImageRequest(dish_id="chicken_rice")
    assert req.image_base64 is None
    assert req.dish_id == "chicken_rice"
