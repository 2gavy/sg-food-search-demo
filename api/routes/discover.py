from fastapi import APIRouter, Query

from api.models import DiscoverClustersResponse
from api.services.clustering import discover_clusters

router = APIRouter(prefix="/discover", tags=["discover"])


@router.get("/clusters", response_model=DiscoverClustersResponse)
def get_clusters(refresh: bool = Query(default=False)) -> DiscoverClustersResponse:
    """Unsupervised topic discovery — density-probed kNN clustering + significant_text labels."""
    return discover_clusters(refresh=refresh)
