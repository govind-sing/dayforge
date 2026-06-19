from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.models.schemas import ScheduleRequest, ScheduleResponse, ScheduleItemUpdate
from app.chains.schedule_chain import run_schedule_chain
import json
from datetime import datetime

router = APIRouter()

@router.post("/generate-schedule", response_model=ScheduleResponse)
async def generate_schedule(
    request: ScheduleRequest,
    user_id: str = Depends(get_current_user_id)
):
    try:
        # 1. Run the LangChain chain
        schedule = await run_schedule_chain(request)

        # 2. Upsert into daily_plans
        plan_data = {
            "user_id": user_id,
            "plan_date": str(request.plan_date),
            "status": "draft",
            "raw_llm_output": schedule.summary,
            "generation_meta": {
                "model": "gemini-2.5-flash",
                "task_count": len(request.tasks),
                "scheduled_count": len(schedule.scheduled),
                "skipped_count": len(schedule.skipped),
                "generated_at": datetime.utcnow().isoformat()
            }
        }

        plan_response = supabase.table("daily_plans").upsert(
            plan_data,
            on_conflict="user_id,plan_date"
        ).execute()

        plan_id = plan_response.data[0]["id"]

        # 3. Delete existing schedule_items for this plan (clean slate)

        # First get completed task IDs from tasks table
        completed = supabase.table("tasks")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("status", "completed")\
            .execute()

        completed_ids = [t["id"] for t in completed.data]

        # Delete only non-completed schedule items
        existing_items = supabase.table("schedule_items")\
            .select("id, task_id")\
            .eq("plan_id", plan_id)\
            .execute()

        items_to_delete = [
            item["id"] for item in existing_items.data
            if item["task_id"] not in completed_ids
        ]

        if items_to_delete:
            supabase.table("schedule_items")\
                .delete()\
                .in_("id", items_to_delete)\
                .execute()

        # 4. Insert new schedule_items
        if schedule.scheduled:
            items = [
                {
                    "plan_id": plan_id,
                    "task_id": item.task_id,
                    "user_id": user_id,
                    "scheduled_start": f"{request.plan_date}T{item.start_time}:00",
                    "scheduled_end": f"{request.plan_date}T{item.end_time}:00",
                    "ai_reasoning": item.reasoning,
                    "position": idx + 1
                }
                for idx, item in enumerate(schedule.scheduled)
            ]
            supabase.table("schedule_items").insert(items).execute()

        # 5. Update task statuses
        scheduled_ids = [item.task_id for item in schedule.scheduled]
        skipped_ids = [item.task_id for item in schedule.skipped]

        if scheduled_ids:
            supabase.table("tasks").update(
                {"status": "scheduled"}
            ).in_("id", scheduled_ids).eq("user_id", user_id).execute()

        if skipped_ids:
            supabase.table("tasks").update(
                {"status": "skipped"}
            ).in_("id", skipped_ids).eq("user_id", user_id).execute()

        return schedule

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON — try again")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/schedule/{plan_date}")
async def get_schedule(
    plan_date: str,
    user_id: str = Depends(get_current_user_id)
):
    try:
        # Get the daily plan
        plan = supabase.table("daily_plans")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("plan_date", plan_date)\
            .single()\
            .execute()

        if not plan.data:
            return None

        plan_id = plan.data["id"]

        # Get schedule items with task details
        items = supabase.table("schedule_items")\
            .select("*, tasks(title, priority, estimated_minutes, status)")\
            .eq("plan_id", plan_id)\
            .order("scheduled_start")\
            .execute()

        # Format into ScheduleResponse shape
        scheduled = []
        for item in items.data:
            task = item["tasks"]
            scheduled.append({
                "task_id": item["task_id"],
                "title": task["title"],
                "start_time": item["scheduled_start"][11:16],  # extract "HH:MM"
                "end_time": item["scheduled_end"][11:16],
                "priority": task["priority"],
                "reasoning": item.get("ai_reasoning", ""),
                "status": task["status"]
            })

        return {
            "plan_date": plan_date,
            "scheduled": scheduled,
            "skipped": [],
            "summary": plan.data.get("raw_llm_output", ""),
        }

    except Exception:
        return None
    

@router.patch("/schedule-item/{task_id}")
async def update_schedule_item(
    task_id: str,
    payload: ScheduleItemUpdate,
    user_id: str = Depends(get_current_user_id)
):
    try:
        # Get plan_id for today's plan
        plan = supabase.table("daily_plans")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("plan_date", payload.plan_date)\
            .single()\
            .execute()

        if not plan.data:
            raise HTTPException(status_code=404, detail="Plan not found")

        plan_id = plan.data["id"]

        supabase.table("schedule_items")\
                .update({
                "scheduled_start": f"{payload.plan_date}T{payload.start_time}:00",
                "scheduled_end": f"{payload.plan_date}T{payload.end_time}:00",
                })\
                .eq("plan_id", plan_id)\
                .eq("task_id", task_id)\
                .execute()

        return {"updated": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))