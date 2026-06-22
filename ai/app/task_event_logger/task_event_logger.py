from datetime import date as date_type
from typing import Union
from supabase import Client
from app.rag.embedder import embed_task_outcome






async def log_completed(
    supabase: Client,
    user_id: str,
    task_id: str,
    task_title: str,
    priority: str,
    scheduled_date,
    scheduled_start: str,
    task_category: str = None,
):
    supabase.table("task_events").insert({
        "user_id": user_id,
        "task_id": task_id,
        "task_title": task_title,
        "task_category": task_category,
        "priority": priority,
        "event_type": "completed",
        "scheduled_date": str(scheduled_date),
        "scheduled_start": scheduled_start,
    }).execute()

    # Embed outcome for RAG retrieval at schedule generation time
    embed_task_outcome(
        user_id=user_id,
        task_id=task_id,
        task_title=task_title,
        priority=priority,
        scheduled_start=scheduled_start,
        event_type="completed",
        event_date=str(scheduled_date),
    )


async def log_skipped(
    supabase: Client,
    user_id: str,
    task_id: str,
    task_title: str,
    priority: str,
    scheduled_date,
    scheduled_start: str,
    task_category: str = None,
):
    supabase.table("task_events").insert({
        "user_id": user_id,
        "task_id": task_id,
        "task_title": task_title,
        "task_category": task_category,
        "priority": priority,
        "event_type": "skipped",
        "scheduled_date": str(scheduled_date),
        "scheduled_start": scheduled_start,
    }).execute()

    embed_task_outcome(
        user_id=user_id,
        task_id=task_id,
        task_title=task_title,
        priority=priority,
        scheduled_start=scheduled_start,
        event_type="skipped",
        event_date=str(scheduled_date),
    )


async def log_rescheduled(
    supabase: Client,
    user_id: str,
    task_id: str,
    task_title: str,
    priority: str,
    prev_date: Union[date_type, str],
    new_date: Union[date_type, str],
    prev_scheduled_start: str,
    new_scheduled_start: str,
    task_category: str = None,
):
    today = date_type.today()

    if isinstance(prev_date, str):
        prev_date = date_type.fromisoformat(prev_date)
    if isinstance(new_date, str):
        new_date = date_type.fromisoformat(new_date)

    carried_forward = (prev_date < today) and (new_date >= today)

    supabase.table("task_events").insert({
        "user_id": user_id,
        "task_id": task_id,
        "task_title": task_title,
        "task_category": task_category,
        "priority": priority,
        "event_type": "rescheduled",
        "prev_date": str(prev_date),
        "new_date": str(new_date),
        "prev_scheduled_start": prev_scheduled_start,
        "new_scheduled_start": new_scheduled_start,
        "carried_forward": carried_forward,
    }).execute()


async def log_deleted(
    supabase: Client,
    user_id: str,
    task_id: str,
    task_title: str,
    priority: str,
    task_category: str = None,
):
    supabase.table("task_events").insert({
        "user_id": user_id,
        "task_id": task_id,
        "task_title": task_title,
        "task_category": task_category,
        "priority": priority,
        "event_type": "deleted",
    }).execute()