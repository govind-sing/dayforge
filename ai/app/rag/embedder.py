from openai import OpenAI
from app.core.config import settings
from app.core.chroma_client import (
    task_outcomes_collection,
    goals_collection,
)

client = OpenAI(
    api_key=settings.JINA_API_KEY,
    base_url="https://api.jina.ai/v1"
)


def get_embedding(text: str) -> list[float]:
    result = client.embeddings.create(
        model="jina-embeddings-v3",
        input=text,
    )

    return result.data[0].embedding


def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    result = client.embeddings.create(
        model="jina-embeddings-v3",
        input=texts,
    )

    return [item.embedding for item in result.data]

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