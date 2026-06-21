import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser
from app.prompts.schedule_prompt import schedule_prompt
from app.core.config import settings
from app.models.schemas import ScheduleRequest, ScheduleResponse
from datetime import datetime

llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.3,
)

schedule_chain = schedule_prompt | llm | StrOutputParser()

def format_tasks(tasks) -> str:
    lines = []
    for t in tasks:
        desc = f" — {t.description}" if t.description else ""
        lines.append(
            f"- [{t.priority.upper()}] {t.title}{desc} ({t.estimated_minutes} mins) [id: {t.id}]"
        )
    return "\n".join(lines) if lines else "No tasks provided."


def format_blocked_slots(slots) -> str:
    if not slots:
        return "None"
    return "\n".join(
        f"- {s.label}: {s.start_time} to {s.end_time}"
        for s in slots
    )

async def run_schedule_chain(request: ScheduleRequest) -> ScheduleResponse:
    tasks_str = format_tasks(request.tasks)
    blocked_str = format_blocked_slots(request.blocked_slots)

    # print("=== SCHEDULE PROMPT ===")
    # print(f"Date: {request.plan_date}")
    # print(f"Work: {request.work_start} - {request.work_end}")
    # print(f"Timezone: {request.timezone}")
    # print(f"Tasks:\n{tasks_str}")
    # print(f"Blocked:\n{blocked_str}")
    # print("=======================")
    raw_output = await schedule_chain.ainvoke({
        "plan_date": str(request.plan_date),
        "work_start": request.work_start,
        "work_end": request.work_end,
        "timezone": request.timezone,
        "tasks": format_tasks(request.tasks),
        "blocked_slots": format_blocked_slots(request.blocked_slots),
    })

    cleaned = raw_output.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()

    parsed = json.loads(cleaned)
    return ScheduleResponse(**parsed)


async def save_schedule(schedule: ScheduleResponse, request: ScheduleRequest, user_id: str):
    """Persist a generated schedule to DB. Shared by schedule router and checkin agent."""
    from app.core.supabase_client import supabase

    plan_data = {
        "user_id": user_id,
        "plan_date": str(request.plan_date),
        "status": "draft",
        "raw_llm_output": schedule.summary,
        "generation_meta": {
            "model": "gemini-3.1-flash-lite",
            "task_count": len(request.tasks),
            "scheduled_count": len(schedule.scheduled),
            "skipped_count": len(schedule.skipped),
            "generated_at": datetime.utcnow().isoformat()
        }
    }

    plan_response = supabase.table("daily_plans").upsert(
        plan_data, on_conflict="user_id,plan_date"
    ).execute()
    plan_id = plan_response.data[0]["id"]

    completed = supabase.table("tasks") \
        .select("id").eq("user_id", user_id).eq("status", "completed").execute()
    completed_ids = [t["id"] for t in completed.data]

    existing_items = supabase.table("schedule_items") \
        .select("id, task_id").eq("plan_id", plan_id).execute()
    items_to_delete = [
        item["id"] for item in existing_items.data
        if item["task_id"] not in completed_ids
    ]
    if items_to_delete:
        supabase.table("schedule_items").delete().in_("id", items_to_delete).execute()

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

    scheduled_ids = [item.task_id for item in schedule.scheduled]
    skipped_ids = [item.task_id for item in schedule.skipped]

    if scheduled_ids:
        supabase.table("tasks").update({"status": "scheduled"}) \
            .in_("id", scheduled_ids).eq("user_id", user_id).execute()
    if skipped_ids:
        supabase.table("tasks").update({"status": "skipped"}) \
            .in_("id", skipped_ids).eq("user_id", user_id).execute()