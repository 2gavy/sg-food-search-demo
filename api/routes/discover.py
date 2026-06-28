from fastapi import APIRouter, HTTPException, Query

from api.models import DiscoverClusterExploreResponse, DiscoverClustersResponse
from api.services.clustering import discover_clusters, explore_cluster

router = APIRouter(prefix="/discover", tags=["discover"])


@router.get("/clusters", response_model=DiscoverClustersResponse)
def get_clusters(refresh: bool = Query(default=False)) -> DiscoverClustersResponse:
    """Density-probed kNN clustering + significant_text labels (Elastic Labs walkthrough)."""
    return discover_clusters(refresh=refresh)


@router.get("/clusters/{cluster_id}/explore", response_model=DiscoverClusterExploreResponse)
def get_cluster_explore(
    cluster_id: str,
    lambda_mmr: float = Query(default=0.5, ge=0.0, le=1.0),
    size: int = Query(default=10, ge=1, le=20),
) -> DiscoverClusterExploreResponse:
    """Diversify retriever (MMR) within a cluster — article cluster breadth step."""
    try:
        return explore_cluster(cluster_id, lambda_mmr=lambda_mmr, size=size)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
