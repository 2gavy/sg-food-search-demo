"""Data asset sanity checks."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_corpus_jsonl_line_count():
    path = ROOT / "data" / "sg_food_corpus.jsonl"
    lines = [ln for ln in path.read_text().splitlines() if ln.strip()]
    assert len(lines) == 280


def test_demo_queries_have_text_and_photo():
    demos = json.loads((ROOT / "data" / "demo_queries.json").read_text())
    modes = {d["mode"] for d in demos}
    assert "text" in modes
    assert "photo" in modes


def test_dish_manifest_covers_gallery():
    manifest = json.loads((ROOT / "data" / "dish_image_manifest.json").read_text())
    dish_ids = {m["dish_id"] for m in manifest}
    assert len(dish_ids) >= 10
    assert "chicken_rice" in dish_ids
    assert "laksa" in dish_ids

    sources_path = ROOT / "data" / "dish_image_sources.json"
    if sources_path.exists():
        sources = json.loads(sources_path.read_text())
        assert len(sources) == len(dish_ids)
