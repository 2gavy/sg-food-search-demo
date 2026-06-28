from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes.agent import router as agent_router
from api.routes.cases import router as cases_router
from api.routes.discover import router as discover_router
from api.routes.search import router as search_router

ROOT = Path(__file__).resolve().parents[1]
WEB_DIST = ROOT / "web" / "dist"

app = FastAPI(title="SG Food Discovery API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)
app.include_router(cases_router)
app.include_router(agent_router)
app.include_router(discover_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Cloud Run / load-balancer probe."""
    return {"status": "ok"}


@app.on_event("startup")
def _warm_gallery_embeddings() -> None:
    try:
        from api.services.embedding_cache import warm_gallery_cache

        warm_gallery_cache()
    except Exception:
        pass

data = ROOT / "data"
if data.exists():
    app.mount("/data", StaticFiles(directory=str(data)), name="data")

if WEB_DIST.exists():
    # Cloud Run / production: built React app (includes /assets/food from public/)
    app.mount("/", StaticFiles(directory=str(WEB_DIST), html=True), name="spa")
else:
    assets = ROOT / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    @app.get("/")
    def root() -> dict:
        return {"service": "sg-food-discovery", "docs": "/docs"}
