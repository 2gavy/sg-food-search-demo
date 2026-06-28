#!/usr/bin/env bash
# One-time / pre-demo setup: clustering embeddings + warm Discover cache.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — set ELASTICSEARCH_URL and ES_API_KEY first."
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate 2>/dev/null || {
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -q -r requirements.txt
}

echo "→ Backfilling Jina clustering embeddings (task=clustering)…"
python3 scripts/backfill_clustering_embeddings.py

echo "→ Warming Discover cluster cache…"
python3 -c "
from api.services.clustering import discover_clusters
r = discover_clusters(refresh=True)
print(f'   {len(r.clusters)} clusters · {r.noise_count} noise · {r.took_ms}ms')
print(f'   {r.summary}')
for c in r.clusters[:5]:
    print(f'   · {c.label} ({c.size} stalls)')
"

echo ""
echo "Ready. Run ./scripts/start-demo.sh"
