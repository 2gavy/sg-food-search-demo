# SG Food Discovery — Presenter Script

## Setup (before audience)

1. Serverless Search project running with ingested corpus (both `embedding` and `embedding_oss` fields)
2. E5 inference endpoint verified: `python3 scripts/setup_inference_oss.py`
3. Web app at http://localhost:5173 (desktop / landscape — three columns on lg screens)
4. All **three columns** visible: Lexical | Open-source E5 | Jina v5 omni

## Act 1 — Text three-way compare (4 min)

1. Point to empty **Lexical | E5 | Jina** columns
2. Select demo query: **Rainy-day soup near Raffles Place**
3. All three columns populate **at the same time**
4. **Lexical (left):** few or weak keyword matches — grey pins on map
5. **E5 (middle):** open-source hybrid surfaces some mood matches — blue pins for E5-only hits
6. **Jina (right):** often surfaces more or different venues — green pins for Jina-only hits
7. Read diff banner: *"Jina surfaced N venues lexical missed"* and *"E5 surfaced M venues lexical missed"*
8. Note venues with **★ all** badge — strong consensus across all three
9. Click a diff chip — map flies to stall

**Talk track:** Keyword search only matches exact tokens. Open-source E5 (384-dim, Apache 2.0) gives a credible hybrid baseline. Jina v5 omni (1024-dim, multimodal) often understands mood and vibe queries better — all stored with DiskBBQ on Elastic Serverless Search.

## Act 2 — Photo three-way (2 min)

1. Toggle **Photo** mode — three-column layout stays
2. Tap **Chicken Rice** in gallery (not raw upload — E5 is text-only)
3. **Lexical:** empty + message *"Lexical search cannot match images"*
4. **E5:** text proxy via dish name — shows related venues but not true visual search
5. **Jina:** omni visual matches populate with **New** badges
6. Same index — Jina column proves multimodal value over text-only OSS

## Act 3 — Save hunt (1 min)

1. Click **Save this hunt** on Jina results
2. Optional: open Agent Builder → SG Food Concierge for narration

## Backup queries

- Halal lunch under $5 near Bugis MRT
- Something like chicken rice but lighter and healthier
- Pedas hawker noodles makcik style

Compare how E5 vs Jina rank **Pedas hawker noodles** — Jina often picks up Malay vibe language better.
