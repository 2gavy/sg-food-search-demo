from fastapi import APIRouter, HTTPException, Request

from api.config import AGENT_BUILDER_AGENT_ID
from api.models import AgentConverseRequest, AgentConverseResponse, AgentStatusResponse
from api.services.agent_builder import AgentBuilderError, agent_configured, converse, llm_configured
from api.services.agent_rate_limit import (
    MAX_ASKS,
    client_key_from_request,
    peek_remaining,
    record_ask,
)

router = APIRouter(prefix="/agent", tags=["agent"])


def _client_key(request: Request, session_id: str | None = None) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    client_ip = forwarded or (request.client.host if request.client else None)
    header_session = session_id or request.headers.get("X-Demo-Session")
    return client_key_from_request(session_id=header_session, client_ip=client_ip)


@router.get("/status", response_model=AgentStatusResponse)
def agent_status(request: Request) -> AgentStatusResponse:
    key = _client_key(request)
    remaining = peek_remaining(key)
    return AgentStatusResponse(
        configured=agent_configured() and llm_configured(),
        agent_id=AGENT_BUILDER_AGENT_ID,
        agent_name="SG Food Concierge",
        llm_configured=llm_configured(),
        asks_limit=MAX_ASKS,
        asks_remaining=remaining,
    )


@router.post("/converse", response_model=AgentConverseResponse)
def agent_converse(req: AgentConverseRequest, request: Request) -> AgentConverseResponse:
    key = _client_key(request, req.session_id)
    if peek_remaining(key) <= 0:
        raise HTTPException(
            status_code=429,
            detail=f"Concierge limit reached ({MAX_ASKS} asks per session). Try again tomorrow or start a new browser session.",
        )

    try:
        result = converse(
            req.message,
            conversation_id=req.conversation_id,
            selection_context=req.selection_context,
        )
    except AgentBuilderError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    remaining = record_ask(key)
    result["asks_remaining"] = remaining
    return AgentConverseResponse(**result)
