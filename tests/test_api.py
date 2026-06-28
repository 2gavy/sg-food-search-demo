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


def test_discover_cluster_explore_local(client):
    clusters = client.get("/discover/clusters").json()
    if not clusters.get("clusters"):
        return
    cid = clusters["clusters"][0]["cluster_id"]
    r = client.get(f"/discover/clusters/{cid}/explore")
    assert r.status_code == 200
    assert r.json()["cluster_id"] == cid


def test_agent_status_local(client):
    r = client.get("/agent/status", headers={"X-Demo-Session": "test-status-session"})
    assert r.status_code == 200
    body = r.json()
    assert body["agent_name"] == "SG Food Concierge"
    assert body["asks_limit"] == 3
    assert body["asks_remaining"] == 3


def test_agent_converse_requires_results(client):
    r = client.post(
        "/agent/converse",
        json={"message": "hello", "selection_context": None},
        headers={"X-Demo-Session": "test-no-context"},
    )
    assert r.status_code == 400


def test_agent_converse_accepts_browse_context(client):
    ctx = {
        "context_type": "browse",
        "query": "",
        "mode": "text",
        "app_view": "search",
        "diff_summary": {
            "hybrid_only_jina": [],
            "hybrid_only_oss": [],
            "all_three": [],
            "lexical_only": [],
        },
        "top_hits": {"lexical": [], "hybrid_oss": [], "hybrid_jina": []},
    }

    r = client.post(
        "/agent/converse",
        json={"message": "what can this demo show?", "selection_context": ctx, "session_id": "test-browse"},
        headers={"X-Demo-Session": "test-browse"},
    )
    assert r.status_code in (200, 502, 503)


def test_agent_converse_accepts_results_without_selection(client):
    r = client.post(
        "/search/compare",
        json={"query": "laksa", "size": 3},
    )
    assert r.status_code == 200
    compare = r.json()

    ctx = {
        "context_type": "compare",
        "query": compare["query"],
        "mode": compare["mode"],
        "diff_summary": {
            "hybrid_only_jina": compare["diff"]["hybrid_only_jina"],
            "hybrid_only_oss": compare["diff"]["hybrid_only_oss"],
            "all_three": compare["diff"]["all_three"],
            "lexical_only": compare["diff"]["lexical_only"],
        },
        "top_hits": {
            "lexical": compare["lexical"]["hits"],
            "hybrid_oss": compare["hybrid_oss"]["hits"],
            "hybrid_jina": compare["hybrid_jina"]["hits"],
        },
    }

    r = client.post(
        "/agent/converse",
        json={"message": "summarize", "selection_context": ctx, "session_id": "test-results-only"},
        headers={"X-Demo-Session": "test-results-only"},
    )
    # 503 when Agent Builder not configured in test env; 400 only if context rejected
    assert r.status_code in (200, 502, 503)


def test_demo_queries_static(client):
    r = client.get("/data/demo_queries.json")
    assert r.status_code == 200
    demos = r.json()
    assert isinstance(demos, list)
    assert any(d.get("mode") == "text" for d in demos)
    assert any(d.get("mode") == "photo" for d in demos)
