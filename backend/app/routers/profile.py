from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase

router = APIRouter(prefix="/api", tags=["profile"])

@router.get("/profile")
async def get_profile(user_id: str = Depends(get_current_user_id)):
    try:
        response = supabase.table("profiles").select(
            "display_name, timezone, work_start, work_end, onboarded"
        ).eq("id", user_id).single().execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))