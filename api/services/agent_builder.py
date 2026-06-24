"""Proxy to Kibana Agent Builder converse API."""

from __future__ import annotations

from typing import Any

import requests

from api.config import AGENT_BUILDER_AGENT_ID, KIBANA_API_KEY, KIBANA_URL, LLM_CONNECTOR_ID
from api.models import VenueGraphResponse
from api.services.elasticsearch import venue_graph


class AgentBuilderError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def agent_configured() -> bool:
    return bool(KIBANA_URL and KIBANA_API_KEY and AGENT_BUILDER_AGENT_ID)


def llm_configured() -> bool:
    return bool(LLM_CONNECTOR_ID)


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"ApiKey {KIBANA_API_KEY}",
        "kbn-xsrf": "true",
        "Content-Type": "application/json",
    }


def _column_line(name: str, placement: dict[str, Any] | None) -> str:
    if not placement:
        return f"- {name}: not in this column"
    parts = [f"- {name}: rank #{placement.get('rank', '?')}"]
    if placement.get("match_reason"):
        parts.append(f"({placement['match_reason']})")
    if placement.get("score") is not None:
        parts.append(f"score={placement['score']:.3f}" if isinstance(placement["score"], float) else f"score={placement['score']}")
    return " ".join(parts)


def _format_graph_context(graph: VenueGraphResponse) -> list[str]:
    if not graph.edges:
        return [
            "",
            "### Graph relationships (structural hops from /search/graph)",
            "No same_dish or same_hawker neighbors found for this venue in the corpus.",
        ]

    nodes_by_id = {n.doc_id: n for n in graph.nodes}
    lines = [
        "",
        "### Graph relationships (structural hops from /search/graph)",
        f"Summary: {graph.summary}",
        f"Engine: {graph.engine or 'structural'} · {graph.es_api or 'GET /search/graph'}",
        "Edge types: same_dish = shared dish_id; same_hawker = co-located stalls at one hawker centre.",
        "For related-store questions, answer ONLY from these hops — do not invent venues.",
    ]

    for hop in (1, 2):
        hop_edges = [e for e in graph.edges if e.hop == hop]
        if not hop_edges:
            continue
        lines.append(f"\n#### Hop {hop}")
        for edge in hop_edges:
            node = nodes_by_id.get(edge.target_id)
            title = node.title if node else edge.target_id
            parts = [f"- **{title}** · {edge.edge_type} · {edge.label}"]
            if node:
                if node.signature_dish:
                    parts.append(f"dish: {node.signature_dish}")
                if node.hawker_centre:
                    parts.append(f"@ {node.hawker_centre}")
                if node.rating is not None:
                    parts.append(f"★{node.rating}")
            parts.append(f"doc_id: {edge.target_id}")
            lines.append(" · ".join(parts))

    return lines


def format_selection_context(selection: dict[str, Any], graph: VenueGraphResponse | None = None) -> str:
    hit = selection.get("selected") or {}
    lines = [
        "## User-selected venue from SG Food Discovery (web app)",
        f"- Search query: {selection.get('query', '')}",
        f"- Search mode: {selection.get('mode', 'text')}",
        "",
        "### Selected venue",
        f"- Title: {hit.get('title', '')}",
        f"- doc_id: {hit.get('doc_id', '')}",
    ]
    if hit.get("signature_dish"):
        lines.append(f"- Dish: {hit['signature_dish']}")
    if hit.get("hawker_centre"):
        lines.append(f"- Hawker centre: {hit['hawker_centre']}")
    if hit.get("neighbourhood"):
        lines.append(f"- Neighbourhood: {hit['neighbourhood']}")
    if hit.get("rating") is not None:
        lines.append(f"- Rating: {hit['rating']}")
    if hit.get("price_range"):
        lines.append(f"- Price: {hit['price_range']}")
    if hit.get("description"):
        lines.append(f"- Description: {hit['description']}")
    if hit.get("distance_metres") is not None:
        lines.append(f"- Distance: {int(hit['distance_metres'])}m")

    columns = selection.get("columns") or {}
    lines.extend(
        [
            "",
            "### Column placement (Keywords · E5 · Jina)",
            _column_line("Keywords (BM25)", columns.get("lexical")),
            _column_line("Open-source hybrid (E5)", columns.get("hybrid_oss")),
            _column_line("Multimodal hybrid (Jina)", columns.get("hybrid_jina")),
        ]
    )

    diff_tags = selection.get("diff_tags") or []
    if diff_tags:
        lines.append("")
        lines.append(f"- Diff tags: {', '.join(diff_tags)}")

    if graph:
        lines.extend(_format_graph_context(graph))
    elif selection.get("graph"):
        # Frontend may pass a cached graph payload
        try:
            cached = VenueGraphResponse.model_validate(selection["graph"])
            lines.extend(_format_graph_context(cached))
        except Exception:
            pass

    lines.append("")
    lines.append(
        "The user selected this venue from their compare results. Explain why it matched, "
        "how the three columns differ for this pick, and practical next steps. "
        "For related stalls, use the Graph relationships hops above — not free-form search guesses."
    )
    return "\n".join(lines)


def converse(
    message: str,
    *,
    conversation_id: str | None = None,
    selection_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not agent_configured():
        raise AgentBuilderError(
            "Agent Builder is not configured. Set ELASTICSEARCH_URL and ES_API_KEY in .env.",
            status_code=503,
        )
    if not selection_context or not selection_context.get("selected"):
        raise AgentBuilderError("Select a venue from the search results first.", status_code=400)
    if not llm_configured():
        raise AgentBuilderError(
            "LLM connector is not configured. Set LLM_CONNECTOR_ID in .env to your Agent Builder model connector.",
            status_code=503,
        )

    graph: VenueGraphResponse | None = None
    if selection_context.get("graph"):
        try:
            graph = VenueGraphResponse.model_validate(selection_context["graph"])
        except Exception:
            graph = None

    if graph is None:
        selected_id = (selection_context.get("selected") or {}).get("doc_id")
        if selected_id:
            try:
                graph = venue_graph(selected_id, hops=2, limit_per_type=2, max_branches=3, engine="auto")
            except Exception:
                graph = None

    payload: dict[str, Any] = {
        "input": f"{format_selection_context(selection_context, graph)}\n\nUser: {message.strip()}",
        "agent_id": AGENT_BUILDER_AGENT_ID,
        "connector_id": LLM_CONNECTOR_ID,
    }
    if conversation_id:
        payload["conversation_id"] = conversation_id

    url = f"{KIBANA_URL.rstrip('/')}/api/agent_builder/converse"
    try:
        resp = requests.post(url, headers=_headers(), json=payload, timeout=120)
    except requests.RequestException as exc:
        raise AgentBuilderError(f"Agent Builder request failed: {exc}") from exc

    if resp.status_code >= 400:
        detail = resp.text[:500]
        raise AgentBuilderError(
            f"Agent Builder returned {resp.status_code}: {detail}",
            status_code=resp.status_code if resp.status_code < 500 else 502,
        )

    data = resp.json()
    response_msg = ""
    if isinstance(data.get("response"), dict):
        response_msg = data["response"].get("message") or ""
    elif isinstance(data.get("response"), str):
        response_msg = data["response"]

    return {
        "conversation_id": data.get("conversation_id"),
        "round_id": data.get("round_id"),
        "status": data.get("status"),
        "message": response_msg or "No response from agent.",
        "steps": data.get("steps") or [],
        "model_usage": data.get("model_usage") or data.get("token_usage"),
        "context_attached": True,
    }
