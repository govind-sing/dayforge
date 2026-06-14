from fastapi import APIRouter, Depends, HTTPException
from app.core.supabase_client import supabase
from app.core.auth import get_current_user_id
from app.models.schemas import TaskUpdate, DailyPlanInput
from uuid import UUID
from datetime import date

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("/daily-plan")
def create_daily_plan(payload: DailyPlanInput, user_id: str = Depends(get_current_user_id)):
    """
    Replaces the day's tasks with the submitted set.
    Simple re-submission model: wipe and recreate for this date.
    """
    plan_date_str = payload.plan_date.isoformat()

    # Clear existing tasks for this user+date (handles re-submission)
    supabase.table("tasks") \
        .delete() \
        .eq("user_id", user_id) \
        .eq("original_date", plan_date_str) \
        .execute()

    task_rows = [
        {
            "user_id": user_id,
            "title": t.title,
            "description": t.description,
            "estimated_minutes": t.estimated_minutes,
            "priority": t.priority,
            "original_date": plan_date_str,
            "status": "pending",
        }
        for t in payload.tasks
    ]

    inserted = []
    if task_rows:
        try:
            inserted = supabase.table("tasks").insert(task_rows).execute().data
        except Exception as e:
            print("DAILY PLAN INSERT ERROR:", repr(e))
            raise HTTPException(status_code=400, detail=str(e))

    return {"plan_date": plan_date_str, "tasks": inserted}


@router.get("/daily-plan")
def get_daily_plan(plan_date: date, user_id: str = Depends(get_current_user_id)):
    """Fetches all tasks for a given date, used to pre-fill the form."""
    result = supabase.table("tasks") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("original_date", plan_date.isoformat()) \
        .order("priority") \
        .execute()

    return {"plan_date": plan_date.isoformat(), "tasks": result.data}


@router.patch("/{task_id}")
def update_task(task_id: UUID, payload: TaskUpdate, user_id: str = Depends(get_current_user_id)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("tasks") \
        .update(update_data) \
        .eq("id", str(task_id)) \
        .eq("user_id", user_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")

    return result.data[0]


@router.delete("/{task_id}")
def delete_task(task_id: UUID, user_id: str = Depends(get_current_user_id)):
    result = supabase.table("tasks") \
        .delete() \
        .eq("id", str(task_id)) \
        .eq("user_id", user_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"deleted": True, "id": str(task_id)}