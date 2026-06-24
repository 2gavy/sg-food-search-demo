"""In-memory cache for gallery dish image embeddings (photo compare demo)."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from api.config import ASSETS_FOOD, DATA_DIR

logger = logging.getLogger(__name__)

_dish_vectors: dict[str, list[float]] = {}


def get_dish_image_embedding(dish_id: str) -> list[float] | None:
    return _dish_vectors.get(dish_id)


def set_dish_image_embedding(dish_id: str, vector: list[float]) -> None:
    _dish_vectors[dish_id] = vector


def gallery_dish_ids_from_demo_queries() -> list[str]:
    path = DATA_DIR / "demo_queries.json"
    if not path.exists():
        return []
    demos = json.loads(path.read_text())
    ids: list[str] = []
    seen: set[str] = set()
    for item in demos:
        dish_id = item.get("dish_id")
        if dish_id and dish_id not in seen:
            seen.add(dish_id)
            ids.append(dish_id)
    return ids


def warm_gallery_cache(dish_ids: list[str] | None = None) -> int:
    """Pre-embed gallery dish images. Returns count of newly cached entries."""
    from api.services.inference import embed_image_base64, file_to_data_uri

    targets = dish_ids or gallery_dish_ids_from_demo_queries()
    warmed = 0
    for dish_id in targets:
        if get_dish_image_embedding(dish_id):
            continue
        path = ASSETS_FOOD / f"{dish_id}.jpg"
        if not path.exists():
            continue
        try:
            data_uri = file_to_data_uri(path)
            vector = embed_image_base64(data_uri, task="retrieval.query")
            set_dish_image_embedding(dish_id, vector)
            warmed += 1
        except Exception as exc:
            logger.warning("Gallery embedding cache skip %s: %s", dish_id, exc)
    if warmed:
        logger.info("Warmed %d gallery dish image embeddings", warmed)
    return warmed
