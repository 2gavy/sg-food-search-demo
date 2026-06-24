from fastapi import APIRouter

from api.models import CreateCaseRequest, CreateCaseResponse
from api.services.elasticsearch import create_case

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CreateCaseResponse)
def save_case(req: CreateCaseRequest) -> CreateCaseResponse:
    result = create_case(req.model_dump())
    return CreateCaseResponse(case_id=result["case_id"], index=result["index"])
