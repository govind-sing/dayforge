from app.core.chroma_client import task_outcomes_collection


def embed_task_outcome(
    user_id: str,
    task_id: str,
    task_title: str,
    priority: str,
    scheduled_start: str,
    event_type: str,
    event_date: str,
):
    time_str = scheduled_start if scheduled_start else "unscheduled"
    text = f"{task_title} | {priority} priority | scheduled at {time_str} | {event_type}"

    scheduled_hour = -1
    if scheduled_start:
        try:
            scheduled_hour = int(scheduled_start.split(":")[0])
        except ValueError:
            pass

    # ChromaDB requires all metadata values to be str/int/float/bool — no None allowed
    task_outcomes_collection.upsert(
        ids=[f"{user_id}:{task_id}"],
        documents=[text],
        metadatas=[{
        "user_id": user_id or "",
        "task_id": task_id or "",
        "event_type": event_type or "",
        "priority": priority or "",
        "scheduled_hour": scheduled_hour,
        "date": event_date or "",
}],
    )