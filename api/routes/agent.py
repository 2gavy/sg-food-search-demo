from fastapi import APIRouter, HTTPException

from api.config import AGENT_BUILDER_AGENT_ID
from api.models import AgentConverseRequest, AgentConverseResponse, AgentStatusResponse
from api.services.agent_builder import AgentBuilderError, agent_configured, converse, llm_configured

router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/status", response_model=AgentStatusResponse)
def agent_status() -> AgentStatusResponse:
    return AgentStatusResponse(
        configured=agent_configured() and llm_configured(),
        agent_id=AGENT_BUILDER_AGENT_ID,
        agent_name="SG Food Concierge",
        llm_configured=llm_configured(),
    )


@router.post("/converse", response_model=AgentConverseResponse)
def agent_converse(req: AgentConverseRequest) -> AgentConverseResponse:
    try:
        result = converse(
            req.message,
            conversation_id=req.conversation_id,
            selection_context=req.selection_context,
        )
    except AgentBuilderError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return AgentConverseResponse(**result)
