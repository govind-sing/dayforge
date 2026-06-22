from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.models.schemas import ScheduleRequest, ScheduleResponse, ScheduleItemUpdate, TaskInput, BlockedSlotInput
from app.chains.schedule_chain import run_schedule_chain, save_schedule
from datetime import datetime
import zoneinfo
import json
from app.rag.retriever import get_past_patterns
router = APIRouter()


def build_schedule_request(user_id: str, plan_date: str) -> ScheduleRequest:
    """Fetch everything from DB and build a ScheduleRequest. Used by both HTTP endpoint and WebSocket checkin."""

    # 1. Fetch profile
    profile_response = supabase.table("profiles") \
        .select("timezone, work_start, work_end") \
        .eq("id", user_id) \
        .execute()
    profile = profile_response.data[0] if profile_response.data else {}
    tz_name = profile.get("timezone", "UTC")
    work_start = str(profile.get("work_start", "06:00"))[:5]
    work_end = str(profile.get("work_end", "23:59"))[:5]

    # 2. Mid-day start logic
    now = datetime.now(zoneinfo.ZoneInfo(tz_name))
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    effective_start = current_time if (plan_date == today and current_time > work_start) else work_start

    # 3. Fetch non-completed tasks for today
    tasks_response = supabase.table("tasks") \
        .select("id, title, description, estimated_minutes, priority, status") \
        .eq("user_id", user_id) \
        .eq("original_date", plan_date) \
        .neq("status", "completed") \
        .execute()

    tasks = [
        TaskInput(
            id=t["id"],
            title=t["title"],
            description=t.get("description"),
            estimated_minutes=t["estimated_minutes"],
            priority=t["priority"],
        )
        for t in tasks_response.data
    ]
    
    # 4. Fetch and filter blocked slots by date
    slots_response = supabase.table("blocked_slots") \
        .select("label, start_time, end_time, active_from") \
        .eq("user_id", user_id) \
        .eq("active_from", plan_date) \
        .execute()

    blocked_slots = [
        BlockedSlotInput(
            label=s["label"],
            start_time=str(s["start_time"])[:5],
            end_time=str(s["end_time"])[:5],
        )
        for s in slots_response.data
    ]
    # 5. Fetch past patterns from ChromaDB
    task_titles = [t.title for t in tasks]
    past_patterns = get_past_patterns(user_id=user_id, task_titles=task_titles)

    return ScheduleRequest(
        plan_date=plan_date,
        work_start=effective_start,
        work_end=work_end,
        timezone=tz_name,
        tasks=tasks,
        blocked_slots=blocked_slots,
        past_patterns=past_patterns,  # new
    
    )   


@router.post("/generate-schedule", response_model=ScheduleResponse)
async def generate_schedule(
    request: ScheduleRequest,
    user_id: str = Depends(get_current_user_id)
):
    try:
        schedule = await run_schedule_chain(request)
        await save_schedule(schedule, request, user_id)
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
        plan = supabase.table("daily_plans") \
            .select("*") \
            .eq("user_id", user_id) \
            .eq("plan_date", plan_date) \
            .single() \
            .execute()

        if not plan.data:
            return None

        plan_id = plan.data["id"]

        items = supabase.table("schedule_items") \
            .select("*, tasks(title, priority, estimated_minutes, status)") \
            .eq("plan_id", plan_id) \
            .order("scheduled_start") \
            .execute()

        scheduled = []
        for item in items.data:
            task = item["tasks"]
            scheduled.append({
                "task_id": item["task_id"],
                "title": task["title"],
                "start_time": item["scheduled_start"][11:16],
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
        plan = supabase.table("daily_plans") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("plan_date", payload.plan_date) \
            .single() \
            .execute()

        if not plan.data:
            raise HTTPException(status_code=404, detail="Plan not found")

        plan_id = plan.data["id"]

        # 1. Fetch current time before updating
        current_item = supabase.table("schedule_items") \
            .select("scheduled_start") \
            .eq("plan_id", plan_id) \
            .eq("task_id", task_id) \
            .maybe_single() \
            .execute()

        # 2. Update schedule item
        supabase.table("schedule_items") \
            .update({
                "scheduled_start": f"{payload.plan_date}T{payload.start_time}:00",
                "scheduled_end": f"{payload.plan_date}T{payload.end_time}:00",
            }) \
            .eq("plan_id", plan_id) \
            .eq("task_id", task_id) \
            .execute()

        # 3. Fetch task details for logging
        task = supabase.table("tasks") \
            .select("title, priority") \
            .eq("id", task_id) \
            .eq("user_id", user_id) \
            .maybe_single() \
            .execute()

        # 4. Log same-day time change as reschedule
        if current_item.data and task.data:
            prev_start = current_item.data["scheduled_start"][11:16]
            supabase.table("task_events").insert({
                "user_id": user_id,
                "task_id": task_id,
                "task_title": task.data["title"],
                "priority": task.data["priority"],
                "event_type": "rescheduled",
                "prev_date": payload.plan_date,
                "new_date": payload.plan_date,
                "prev_scheduled_start": prev_start,
                "new_scheduled_start": payload.start_time,
                "carried_forward": False,
            }).execute()

        return {"updated": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))