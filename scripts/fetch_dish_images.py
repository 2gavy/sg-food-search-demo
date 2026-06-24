#!/usr/bin/env python3
"""Download real dish photos from curated free sources (Unsplash / Wikimedia)."""

from __future__ import annotations

import json
import shutil
import sys
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "food"
WEB_ASSETS = ROOT / "web" / "public" / "assets" / "food"
SOURCES_PATH = ROOT / "data" / "dish_image_sources.json"
MANIFEST_PATH = ROOT / "data" / "dish_image_manifest.json"

TARGET_SIZE = 640
JPEG_QUALITY = 88
USER_AGENT = "sg-food-search-demo/1.0 (Elastic demo; image fetch)"


def load_sources() -> dict[str, dict]:
    if not SOURCES_PATH.exists():
        raise FileNotFoundError(f"Missing source catalog: {SOURCES_PATH}")
    return json.loads(SOURCES_PATH.read_text())


def expected_dish_ids() -> list[str]:
    if MANIFEST_PATH.exists():
        manifest = json.loads(MANIFEST_PATH.read_text())
        return [item["dish_id"] for item in manifest]
    return list(load_sources().keys())


def download_bytes(url: str) -> bytes:
    last_error: Exception | None = None
    for attempt in range(5):
        if attempt:
            time.sleep(2 ** attempt)
        try:
            response = requests.get(
                url,
                headers={"User-Agent": USER_AGENT},
                timeout=60,
                allow_redirects=True,
            )
            if response.status_code == 429:
                last_error = requests.HTTPError(f"429 rate limited: {url}")
                continue
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "html" in content_type.lower():
                raise ValueError(f"Expected image, got HTML from {url}")
            return response.content
        except requests.RequestException as exc:
            last_error = exc
    raise RuntimeError(f"Failed to download {url}") from last_error


def normalize_image(data: bytes) -> bytes:
    with Image.open(BytesIO(data)) as img:
        img = img.convert("RGB")
        w, h = img.size
        scale = min(TARGET_SIZE / w, TARGET_SIZE / h, 1.0)
        if scale < 1.0:
            img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
        out = BytesIO()
        img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        return out.getvalue()


def sync_to_web() -> None:
    WEB_ASSETS.mkdir(parents=True, exist_ok=True)
    for path in ASSETS.glob("*.jpg"):
        shutil.copy2(path, WEB_ASSETS / path.name)
    print(f"Synced {len(list(ASSETS.glob('*.jpg')))} images to {WEB_ASSETS.relative_to(ROOT)}")


def fetch_all(*, force: bool = False) -> None:
    sources = load_sources()
    dish_ids = expected_dish_ids()
    missing = [d for d in dish_ids if d not in sources]
    if missing:
        raise SystemExit(f"Missing sources for: {', '.join(missing)}")

    ASSETS.mkdir(parents=True, exist_ok=True)
    for dish_id in dish_ids:
        dest = ASSETS / f"{dish_id}.jpg"
        if dest.exists() and not force:
            print(f"Skip {dish_id}.jpg (exists; use --force to re-download)")
            continue

        meta = sources[dish_id]
        url = meta["url"]
        print(f"Fetching {dish_id} from {meta['source']} …")
        time.sleep(2.5)
        raw = download_bytes(url)
        normalized = normalize_image(raw)
        dest.write_bytes(normalized)
        with Image.open(dest) as img:
            print(f"  saved {dest.name} ({img.size[0]}x{img.size[1]}, {dest.stat().st_size // 1024} KB)")

    sync_to_web()
    print("Done.")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Fetch real dish photos for the SG Food demo")
    parser.add_argument("--force", action="store_true", help="Re-download even if JPG already exists")
    args = parser.parse_args()
    fetch_all(force=args.force)


if __name__ == "__main__":
    main()
