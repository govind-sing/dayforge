from fastapi import APIRouter, Depends, HTTPException
from app.core.supabase_client import supabase
from app.core.auth import get_current_user_id
from app.models.schemas import BlockedSlotInput
from uuid import UUID

router = APIRouter(prefix="/api/blocked-slots", tags=["blocked-slots"])


@router.post("")
def create_blocked_slot(payload: BlockedSlotInput, user_id: str = Depends(get_current_user_id)):
    data = payload.model_dump(mode="json", exclude_none=True)
    data["user_id"] = user_id

    try:
        result = supabase.table("blocked_slots").insert(data).execute()
    except Exception as e:
        print("BLOCKED SLOT INSERT ERROR:", repr(e))
        raise HTTPException(status_code=400, detail=str(e))

    return result.data[0]

@router.get("")
def list_blocked_slots(user_id: str = Depends(get_current_user_id)):
    result = supabase.table("blocked_slots") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("start_time") \
        .execute()
    return result.data


@router.delete("/{slot_id}")
def delete_blocked_slot(slot_id: UUID, user_id: str = Depends(get_current_user_id)):
    result = supabase.table("blocked_slots") \
        .delete() \
        .eq("id", str(slot_id)) \
        .eq("user_id", user_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Slot not found")

    return {"deleted": True, "id": str(slot_id)}