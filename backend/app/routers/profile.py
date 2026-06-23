from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase

router = APIRouter(prefix="/api", tags=["profile"])

class UpdateProfileRequest(BaseModel):
    work_start: Optional[str] = None  # "HH:MM"
    work_end: Optional[str] = None

@router.get("/profile")
async def get_profile(user_id: str = Depends(get_current_user_id)):
    try:
        profile_res = supabase.table("profiles").select(
    "display_name, email, work_start, work_end"
).eq("id", user_id).single().execute()

        if not profile_res.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        goals_res = supabase.table("goals").select(
            "id, title, description, deadline, created_at"
        ).eq("user_id", user_id).order("created_at", desc=False).execute()

        return {
            **profile_res.data,
            "goals": goals_res.data or []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id)
):
    try:
        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="Nothing to update")

        response = supabase.table("profiles").update(updates).eq("id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))