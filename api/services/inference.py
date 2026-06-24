"""Elastic Inference Service helpers for Jina v5 omni and open-source E5."""

from __future__ import annotations

import base64
import time
from pathlib import Path

import requests

from api.config import (
    ELASTICSEARCH_URL,
    ES_API_KEY,
    INFERENCE_ENDPOINT_ID,
    INFERENCE_ENDPOINT_OSS_ID,
)


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"ApiKey {ES_API_KEY}",
        "Content-Type": "application/json",
    }


def _inference_url(endpoint_id: str, task_type: str = "embedding") -> str:
    base = ELASTICSEARCH_URL.rstrip("/")
    return f"{base}/_inference/{task_type}/{endpoint_id}"


def _parse_embedding(data: dict) -> list[float]:
    if "embeddings" in data:
        item = data["embeddings"][0]
        return item["embedding"] if isinstance(item, dict) else item
    if "text_embedding" in data:
        return data["text_embedding"][0]["embedding"]
    if "image_embedding" in data:
        item = data["image_embedding"][0]
        return item["embedding"] if isinstance(item, dict) else item
    if "embedding" in data:
        emb = data["embedding"]
        return emb[0] if isinstance(emb[0], list) else emb
    raise ValueError(f"Unexpected inference response keys: {list(data.keys())}")


def embed_text(text: str, task: str = "retrieval.query") -> list[float]:
    body = {"input": text, "task_settings": {"task": task}}
    resp = requests.post(
        _inference_url(INFERENCE_ENDPOINT_ID),
        headers=_headers(),
        json=body,
        timeout=120,
    )
    resp.raise_for_status()
    return _parse_embedding(resp.json())


def embed_text_oss(text: str, *, query: bool = True) -> list[float]:
    """Embed text with multilingual-e5-small (query:/passage: prefix convention)."""
    prefix = "query: " if query else "passage: "
    body = {"input": prefix + text}
    url = _inference_url(INFERENCE_ENDPOINT_OSS_ID, task_type="text_embedding")
    last_exc: Exception | None = None
    for attempt in range(3):
        resp = requests.post(url, headers=_headers(), json=body, timeout=180)
        if resp.ok:
            return _parse_embedding(resp.json())
        if resp.status_code in (408, 429, 503, 504):
            last_exc = requests.HTTPError(f"{resp.status_code} on attempt {attempt + 1}", response=resp)
            time.sleep(2 * (attempt + 1))
            continue
        resp.raise_for_status()
    if last_exc:
        raise last_exc
    raise RuntimeError("OSS embedding failed after retries")


def embed_image_base64(data_uri: str, task: str = "retrieval.query") -> list[float]:
    for body in (
        {"input": "", "input_type": "image", "image": data_uri, "task_settings": {"task": task}},
        {"input": data_uri, "task_settings": {"task": task}},
    ):
        resp = requests.post(
            _inference_url(INFERENCE_ENDPOINT_ID),
            headers=_headers(),
            json=body,
            timeout=120,
        )
        if resp.ok:
            return _parse_embedding(resp.json())
        if resp.status_code not in (400, 422):
            resp.raise_for_status()
    raise RuntimeError("Image inference failed with all payload formats")


def file_to_data_uri(path: Path) -> str:
    raw = path.read_bytes()
    b64 = base64.b64encode(raw).decode("ascii")
    suffix = path.suffix.lower().lstrip(".")
    mime = "jpeg" if suffix in {"jpg", "jpeg"} else suffix
    return f"data:image/{mime};base64,{b64}"
