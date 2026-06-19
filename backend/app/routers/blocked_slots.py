from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.supabase_client import supabase
from app.core.auth import get_current_user_id
from app.models.schemas import BlockedSlotInput, BlockedSlotUpdate
from uuid import UUID
from datetime import date as DateType
from typing import Optional

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
def list_blocked_slots(
    user_id: str = Depends(get_current_user_id),
    date: Optional[str] = Query(None, description="Filter slots for a specific date (YYYY-MM-DD)")
):
    result = supabase.table("blocked_slots") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("start_time") \
        .execute()

    slots = result.data

    # If no date provided, return all slots unfiltered (for management UI)
    if not date:
        return slots

    try:
        plan_date = DateType.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    weekday = plan_date.weekday()  # Monday=0, Sunday=6

    filtered = []
    for slot in slots:
        recurrence = slot.get("recurrence", "none")
        active_from = slot.get("active_from")
        active_until = slot.get("active_until")

        # Check active_from / active_until window first
        if active_from and DateType.fromisoformat(active_from) > plan_date:
            continue
        if active_until and DateType.fromisoformat(active_until) < plan_date:
            continue

        if recurrence == "none":
            # One-time slot — only applies on active_from date
            if active_from and DateType.fromisoformat(active_from) == plan_date:
                filtered.append(slot)

        elif recurrence == "daily":
            filtered.append(slot)

        elif recurrence == "weekdays":
            # Monday=0 to Friday=4
            if weekday <= 4:
                filtered.append(slot)

        elif recurrence == "weekly":
            # day_of_week stored as 0=Monday, 6=Sunday
            if slot.get("day_of_week") == weekday:
                filtered.append(slot)

    return filtered


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


@router.patch("/{slot_id}")
def update_blocked_slot(
    slot_id: UUID,
    payload: BlockedSlotUpdate,
    user_id: str = Depends(get_current_user_id)
):
    try:
        result = supabase.table("blocked_slots")\
            .update({
                "start_time": str(payload.start_time),
                "end_time": str(payload.end_time),
            })\
            .eq("id", str(slot_id))\
            .eq("user_id", user_id)\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Slot not found")

        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))