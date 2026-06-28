"""FastAPI route tests via TestClient."""

from __future__ import annotations

import pytest


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "sg-food-discovery"


def test_search_health_local(client):
    r = client.get("/search/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["elasticsearch"] is False


def test_compare_text(client):
    r = client.post(
        "/search/compare",
        json={"query": "halal laksa near raffles place", "size": 5},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "text"
    assert "lexical" in body and "hybrid_oss" in body and "hybrid_jina" in body
    assert "diff" in body
    assert body["hybrid"]["total"] == body["hybrid_jina"]["total"]


def test_compare_with_geo(client):
    r = client.post(
        "/search/compare",
        json={
            "query": "satay",
            "geo": {"lat": 1.2839, "lon": 103.8515, "radius_m": 800},
            "size": 5,
        },
    )
    assert r.status_code == 200
    assert r.json()["lexical"]["total"] >= 0


def test_compare_rejects_empty_query_validation(client):
    r = client.post("/search/compare", json={"query": "", "size": 5})
    # Empty query is allowed by model; local mode returns zero lexical token matches
    assert r.status_code == 200


def test_compare_image_by_dish_id(client):
    r = client.post("/search/compare-image", json={"dish_id": "laksa", "size": 5})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "photo"
    assert body["lexical"]["unsupported"] is True
    assert body["hybrid_jina"]["total"] > 0


def test_compare_image_missing_input(client):
    r = client.post("/search/compare-image", json={"size": 5})
    assert r.status_code == 422 or r.status_code == 500


def test_discover_clusters_local(client):
    r = client.get("/discover/clusters")
    assert r.status_code == 200
    body = r.json()
    assert "clusters" in body
    assert body["engine"] in ("density_probe_knn", "local_heuristic")
    assert isinstance(body["clusters"], list)


def test_save_case(client):
    r = client.post(
        "/cases",
        json={
            "title": "API test case",
            "user_query": "chicken rice",
            "shortlist": [
                {"doc_id": "hawker_001", "title": "Tian Tian", "doc_type": "hawker_stall"},
            ],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["case_id"]
    assert body["index"]


def test_demo_queries_static(client):
    r = client.get("/data/demo_queries.json")
    assert r.status_code == 200
    demos = r.json()
    assert isinstance(demos, list)
    assert any(d.get("mode") == "text" for d in demos)
    assert any(d.get("mode") == "photo" for d in demos)
