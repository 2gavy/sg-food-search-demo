#!/usr/bin/env bash
# Run API + web against your existing Elastic Cloud project (.env required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy it from your other laptop (or cp .env.example .env and fill in ES credentials)."
  exit 1
fi

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt

if [[ ! -d web/node_modules ]]; then
  (cd web && npm install)
fi

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "API  → http://127.0.0.1:8000"
uvicorn api.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!

echo "Web  → http://127.0.0.1:5173"
(cd web && npm run dev -- --host 127.0.0.1 --port 5173) &
WEB_PID=$!

echo "Press Ctrl+C to stop both."
wait
