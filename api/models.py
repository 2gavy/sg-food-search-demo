"""Pydantic models for API requests and responses."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, computed_field


class GeoFilter(BaseModel):
    lat: float | None = None
    lon: float | None = None
    radius_m: int = Field(default=1500, ge=100, le=10000)


class CompareRequest(BaseModel):
    query: str
    geo: GeoFilter | None = None
    doc_types: list[str] | None = None
    dietary_tags: list[str] | None = None
    size: int = Field(default=10, ge=1, le=50)


class CompareImageRequest(BaseModel):
    image_base64: str | None = None
    dish_id: str | None = None
    geo: GeoFilter | None = None
    size: int = Field(default=10, ge=1, le=50)


class Hit(BaseModel):
    doc_id: str
    title: str
    doc_type: str
    venue_tier: str | None = None
    description: str | None = None
    signature_dish: str | None = None
    dish_id: str | None = None
    hawker_centre: str | None = None
    neighbourhood: str | None = None
    location: dict[str, float] | None = None
    hero_image_url: str | None = None
    rating: float | None = None
    price_range: str | None = None
    distance_metres: float | None = None
    match_reason: str | None = None
    score: float | None = None
    rank: int | None = None


class SearchSide(BaseModel):
    hits: list[Hit] = Field(default_factory=list)
    total: int = 0
    took_ms: int = 0
    unsupported: bool = False
    message: str | None = None


class CompareDiff(BaseModel):
    hybrid_only_jina: list[str] = Field(default_factory=list)
    hybrid_only_oss: list[str] = Field(default_factory=list)
    lexical_only: list[str] = Field(default_factory=list)
    all_three: list[str] = Field(default_factory=list)
    jina_only: list[str] = Field(default_factory=list)
    oss_only: list[str] = Field(default_factory=list)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def hybrid_only(self) -> list[str]:
        """Backward-compatible alias for hybrid_only_jina."""
        return self.hybrid_only_jina

    @computed_field  # type: ignore[prop-decorator]
    @property
    def both(self) -> list[str]:
        """Backward-compatible alias for all_three."""
        return self.all_three


class CompareResponse(BaseModel):
    query: str
    mode: Literal["text", "photo"] = "text"
    lexical: SearchSide
    hybrid_oss: SearchSide
    hybrid_jina: SearchSide
    diff: CompareDiff

    @computed_field  # type: ignore[prop-decorator]
    @property
    def hybrid(self) -> SearchSide:
        """Backward-compatible alias for hybrid_jina."""
        return self.hybrid_jina


class ShortlistItem(BaseModel):
    doc_id: str
    title: str
    doc_type: str
    match_reason: str | None = None
    location: dict[str, float] | None = None


class CreateCaseRequest(BaseModel):
    title: str
    user_query: str
    shortlist: list[ShortlistItem]
    anchor_location: dict[str, float] | None = None
    search_radius_metres: int | None = None
    dietary_tags: list[str] = Field(default_factory=list)
    agent_notes: str | None = None


class CreateCaseResponse(BaseModel):
    case_id: str
    index: str


class GraphEdge(BaseModel):
    source_id: str
    target_id: str
    edge_type: Literal["same_dish", "same_hawker", "semantic_similar", "graph_explore"]
    label: str
    es_pattern: str
    hop: int = 1


class VenueGraphResponse(BaseModel):
    center_id: str
    edges: list[GraphEdge] = Field(default_factory=list)
    nodes: list[Hit] = Field(default_factory=list)
    took_ms: int = 0
    summary: str = ""
    engine: Literal["explore", "structural"] = "structural"
    es_api: str = "POST /{index}/_graph/explore (fallback: term traversals on Serverless)"


class AgentStatusResponse(BaseModel):
    configured: bool
    agent_id: str
    agent_name: str
    llm_configured: bool = False


class AgentConverseRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: str | None = None
    selection_context: dict | None = None


class AgentConverseResponse(BaseModel):
    conversation_id: str | None = None
    round_id: str | None = None
    status: str | None = None
    message: str
    steps: list[dict] = Field(default_factory=list)
    model_usage: dict | None = None
    context_attached: bool = False
