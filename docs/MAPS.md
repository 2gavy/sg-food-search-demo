# Maps setup for SG Food Discovery

The demo uses **Leaflet + OpenStreetMap** by default. **No API key is required** for the map to work.

## What you need (default — recommended)

**Nothing extra.** The web app loads:

- **Leaflet** — map rendering (`react-leaflet`)
- **OpenStreetMap tiles** — free tile server at `tile.openstreetmap.org`

Pins are colour-coded on a single map:

- Grey = lexical-only results
- Green = hybrid-only results
- Gold = in both columns

## Run the demo

```bash
# Terminal 1 — API (serves /assets/food images + search)
cd sg-food-search-demo
uvicorn api.main:app --reload --port 8000

# Terminal 2 — Web UI
cd sg-food-search-demo/web
npm install   # first time only
npm run dev
```

Open http://localhost:5173

The Vite dev server proxies `/search`, `/cases`, and `/assets` to the API on port 8000.

## Optional: Mapbox (Grab/Foodpanda-style polish)

Only needed if you want Mapbox styling instead of OSM.

1. Create a free account at https://account.mapbox.com/
2. Copy your **public access token** (starts with `pk.`)
3. Add to `.env`:
   ```
   MAPBOX_ACCESS_TOKEN=pk.your_token_here
   ```
4. Switching to Mapbox requires code changes in `web/src/components/SyncMapView.tsx` (currently OSM).

For demos, **OSM is sufficient** and avoids token setup.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Map tiles blank | Check network access to `tile.openstreetmap.org` |
| No pins | Run a search first; pins come from API results |
| Images missing on cards | Ensure API is running on :8000 (serves `/assets/food/`) |
| Map not loading in corporate network | OSM tiles may be blocked; try mobile hotspot or Mapbox |

## Geo search on the map

When a demo query includes a location (e.g. Bugis MRT), the API applies a `geo_distance` filter. A green circle can be drawn around the anchor point when lat/lon/radius are passed in the compare request.

Demo queries with geo are pre-configured in `data/demo_queries.json`.
