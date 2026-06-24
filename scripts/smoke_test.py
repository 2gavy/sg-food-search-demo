#!/usr/bin/env python3
"""Smoke test: compare API text + image + case save (local or ES mode)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.services.elasticsearch import compare_image, compare_text_es, create_case, es_configured


def main() -> int:
    print("Elasticsearch configured:", es_configured())

    r1 = compare_text_es("Warm soupy comfort food near Raffles Place", lat=1.2839, lon=103.8515, radius_m=1200)
    print("\n[text compare]")
    print("  lexical:", r1.lexical.total, "oss:", r1.hybrid_oss.total, "jina:", r1.hybrid_jina.total)
    print("  hybrid_only_jina:", len(r1.diff.hybrid_only_jina))
    print("  hybrid_only_oss:", len(r1.diff.hybrid_only_oss))
    print("  all_three:", len(r1.diff.all_three))
    assert r1.lexical.hits is not None and r1.hybrid_jina.hits is not None
    assert r1.hybrid.total == r1.hybrid_jina.total  # backward compat

    r2 = compare_image(dish_id="chicken_rice")
    print("\n[photo compare]")
    print("  lexical unsupported:", r2.lexical.unsupported)
    print("  jina:", r2.hybrid_jina.total)
    print("  oss:", r2.hybrid_oss.total, "unsupported:", r2.hybrid_oss.unsupported)
    assert r2.lexical.unsupported
    assert r2.hybrid_jina.total > 0

    case = create_case({
        "title": "Smoke test hunt",
        "user_query": "chicken rice photo",
        "shortlist": [{"doc_id": h.doc_id, "title": h.title, "doc_type": h.doc_type} for h in r2.hybrid_jina.hits[:3]],
    })
    print("\n[case]", case["case_id"])

    print("\nAll smoke tests passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
