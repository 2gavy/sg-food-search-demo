"""In-memory rate limit for Agent Builder demo asks (per session or IP)."""

from __future__ import annotations

import time
from threading import Lock

MAX_ASKS = 3
WINDOW_SEC = 24 * 60 * 60

_lock = Lock()
_buckets: dict[str, list[float]] = {}


def _prune(timestamps: list[float], now: float) -> list[float]:
    return [t for t in timestamps if now - t < WINDOW_SEC]


def peek_remaining(client_key: str) -> int:
    now = time.time()
    with _lock:
        hits = _prune(_buckets.get(client_key, []), now)
        return max(0, MAX_ASKS - len(hits))


def record_ask(client_key: str) -> int:
    """Record a successful ask; return remaining after this ask."""
    now = time.time()
    with _lock:
        hits = _prune(_buckets.get(client_key, []), now)
        hits.append(now)
        _buckets[client_key] = hits
        return max(0, MAX_ASKS - len(hits))


def check_and_record(client_key: str) -> tuple[bool, int]:
    """Return (allowed, remaining_after_this_request)."""
    now = time.time()
    with _lock:
        hits = _prune(_buckets.get(client_key, []), now)
        if len(hits) >= MAX_ASKS:
            _buckets[client_key] = hits
            return False, 0
        hits.append(now)
        _buckets[client_key] = hits
        return True, MAX_ASKS - len(hits)


def client_key_from_request(*, session_id: str | None, client_ip: str | None) -> str:
    if session_id and session_id.strip():
        return f"session:{session_id.strip()[:128]}"
    ip = (client_ip or "unknown").strip()[:128]
    return f"ip:{ip}"
