# SG Food Discovery — Presenter Script

## Setup (before audience)

1. **Prep once** (or after re-ingest):
   ```bash
   ./scripts/prep-demo.sh
   ```
2. Start: `./scripts/start-demo.sh` → http://127.0.0.1:5173

## Act 0 — Food scenes (optional opener, 2 min)

1. **Discover** tab — stalls grouped by clustering embeddings into scenes (hawker centre, neighbourhood, dish).
2. Pick a card that reads naturally, e.g. **Maxwell Food Centre · Chicken rice** or **Katong · Laksa**.
3. **Search this scene** → same index, three compare columns.

**Talk track:** Clustering embeddings (`task=clustering`) group venues by food scene. Labels come from real fields — hawker centre, dish, neighbourhood — not from a search query.

## Act 1 — Text three-way compare (4 min)

1. Demo query: **Rainy-day soup near Raffles Place**
2. All three columns populate together — Lexical | E5 | Jina
3. Diff banner, map pins, select stall for graph + Concierge

## Act 2 — Photo three-way (2 min)

1. **Photo** mode → tap **Chicken Rice** in gallery
2. Lexical empty · E5 text proxy · Jina visual kNN

## Act 3 — Concierge (1 min)

Selected stall + graph context → Agent Builder chat.

## Backup queries

- Halal lunch under $5 near Bugis MRT
- Something like chicken rice but lighter and healthier
- Pedas hawker noodles makcik style
