# SG Food Discovery

Singapore hawker & restaurant search demo — **Keywords (BM25) · E5 hybrid · Jina v5 omni** side-by-side, map + graph hops, photo search, and an **Agent Builder** concierge.

Built for **Elastic Cloud Serverless Search** (Jina EIS, DiskBBQ, hybrid RRF).

## What you need

- **Python 3.10+**
- **Node.js 18+**
- An **existing** Elastic Cloud Search project with corpus already ingested (or use local UI-only mode without `.env`)

## Run on any laptop (UI + API only)

Uses your cloud Elasticsearch — **no re-ingest** on a new machine.

### 1. Get the code

```bash
git clone https://github.com/2gavy/sg-food-search-demo.git
cd sg-food-search-demo
```

### 2. Add credentials (not in git)

```bash
cp .env.example .env
```

Edit `.env` — minimum:

```env
ELASTICSEARCH_URL=https://your-project.es.region.aws.elastic.cloud:443
ES_API_KEY=your-api-key
LLM_CONNECTOR_ID=Anthropic-Claude-Sonnet-4-6   # for Concierge (optional)
```

`KIBANA_URL` / `KIBANA_API_KEY` default from the ES URL/key. **Never commit `.env`.**

### 3. Start

```bash
chmod +x scripts/start-demo.sh
./scripts/start-demo.sh
```

Open **http://127.0.0.1:5173**

Or two terminals:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --host 127.0.0.1 --port 8000
```

```bash
cd web && npm install && npm run dev -- --host 127.0.0.1 --port 5173
```

## Features

| Area | Details |
|------|---------|
| **Compare** | Three columns update together: lexical, multilingual E5, Jina omni |
| **Photo** | Upload or pick a gallery dish — Jina multimodal column |
| **Map** | Leaflet/OSM pins, 2-hop graph (`same_dish` / `same_hawker`) |
| **Concierge** | Bottom-right Agent Builder chat — sends selected venue + graph hops |

## API (proxied by Vite in dev)

| Endpoint | Purpose |
|----------|---------|
| `POST /search/compare` | Text compare (3 columns) |
| `POST /search/compare-image` | Photo compare |
| `GET /search/graph/{doc_id}` | Graph hops for map + Concierge |
| `GET /agent/status` | Agent Builder configured? |
| `POST /agent/converse` | Concierge chat |

API docs: http://127.0.0.1:8000/docs

## Agent Builder (one-time per Kibana project)

```bash
python3 scripts/setup_agent_builder.py
```

Creates the `sg-food-concierge` agent if missing. Requires `LLM_CONNECTOR_ID` in `.env`.

## Local mode (no Elasticsearch)

Omit `.env` or leave credentials empty — the API scores an in-memory corpus so you can demo the UI layout offline.

## First-time Elastic setup

Only if you are provisioning a **new** cluster (not needed when reusing an existing project):

```bash
pip install -r requirements.txt
python3 scripts/generate_synthetic_data.py
python3 scripts/setup_inference_oss.py
python3 scripts/setup_indices.py
python3 scripts/ingest_corpus.py
python3 scripts/ingest_dish_images.py
python3 scripts/setup_agent_builder.py
```

Presenter notes: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) · Maps: [docs/MAPS.md](docs/MAPS.md)

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

## License

Demo / internal use — Elastic & Jina models subject to their respective cloud terms.
