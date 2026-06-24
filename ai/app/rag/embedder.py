import google.generativeai as genai
from app.core.config import settings
from app.core.chroma_client import task_outcomes_collection, goals_collection

genai.configure(api_key=settings.GEMINI_API_KEY)

def get_embedding(text: str) -> list[float]:
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text,
        task_type="SEMANTIC_SIMILARITY",
    )
    return result["embedding"]


def embed_task_outcome(user_id, task_id, task_title, priority, scheduled_start, event_type, event_date):
    time_str = scheduled_start if scheduled_start else "unscheduled"
    text = f"{task_title} | {priority} priority | scheduled at {time_str} | {event_type}"

    scheduled_hour = -1
    if scheduled_start:
        try:
            scheduled_hour = int(scheduled_start.split(":")[0])
        except ValueError:
            pass

    embedding = get_embedding(text)

    task_outcomes_collection.upsert(
        ids=[f"{user_id}:{task_id}"],
        documents=[text],
        embeddings=[embedding],
        metadatas=[{
            "user_id": user_id or "",
            "task_id": task_id or "",
            "event_type": event_type or "",
            "priority": priority or "",
            "scheduled_hour": scheduled_hour,
            "date": event_date or "",
        }],
    )


def embed_goal(user_id, goal_id, title, description):
    text = f"{title} | {description}" if description else title
    embedding = get_embedding(text)

    goals_collection.upsert(
        ids=[f"{user_id}:{goal_id}"],
        documents=[text],
        embeddings=[embedding],
        metadatas=[{
            "user_id": user_id,
            "goal_id": goal_id,
            "title": title,
            "description": description or "",
        }],
    )


def delete_goal_embedding(user_id: str, goal_id: str):
    goals_collection.delete(ids=[f"{user_id}:{goal_id}"])