from fastapi import APIRouter

from api.models import CompareImageRequest, CompareRequest, CompareResponse, CreateCaseRequest, CreateCaseResponse, VenueGraphResponse
from api.services.elasticsearch import compare_image, compare_text_es, create_case, es_configured, venue_graph

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "elasticsearch": es_configured()}


@router.post("/compare", response_model=CompareResponse)
def search_compare(req: CompareRequest) -> CompareResponse:
    geo = req.geo
    return compare_text_es(
        query=req.query,
        lat=geo.lat if geo else None,
        lon=geo.lon if geo else None,
        radius_m=geo.radius_m if geo else None,
        doc_types=req.doc_types,
        dietary=req.dietary_tags,
        size=req.size,
    )


@router.get("/graph/{doc_id}", response_model=VenueGraphResponse)
def search_graph(
    doc_id: str,
    limit: int = 2,
    hops: int = 2,
    engine: str = "auto",
) -> VenueGraphResponse:
    """Graph relationships for a venue.

    engine=auto tries Elasticsearch ``POST /{index}/_graph/explore`` first, then falls back
    to structural term hops on Serverless (where Graph explore returns 410).
    """
    return venue_graph(
        doc_id,
        hops=min(max(hops, 1), 2),
        limit_per_type=min(max(limit, 1), 4),
        engine=engine if engine in ("auto", "explore", "structural") else "auto",
    )


@router.post("/compare-image", response_model=CompareResponse)
def search_compare_image(req: CompareImageRequest) -> CompareResponse:
    geo = req.geo
    return compare_image(
        image_base64=req.image_base64,
        dish_id=req.dish_id,
        lat=geo.lat if geo else None,
        lon=geo.lon if geo else None,
        radius_m=geo.radius_m if geo else None,
        size=req.size,
    )
