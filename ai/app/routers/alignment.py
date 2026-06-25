from fastapi import APIRouter, Header, HTTPException
from app.core.supabase_client import supabase
from app.rag.alignment import get_alignment_score, get_neglected_goals
from gotrue.errors import AuthApiError

router = APIRouter()


def get_user_id(token: str) -> str:
    try:
        response = supabase.auth.get_user(token)
        user = response.user
        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized")
        return user.id
    except AuthApiError:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/alignment/score")
async def alignment_score(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user_id = get_user_id(token)

    score = await get_alignment_score(user_id)

    return {
        "has_goals": score is not None,
        "alignment": score,
    }


@router.get("/alignment/neglected")
async def neglected_goals(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user_id = get_user_id(token)

    neglected = await get_neglected_goals(user_id)

    return {
        "neglected": neglected,
    }