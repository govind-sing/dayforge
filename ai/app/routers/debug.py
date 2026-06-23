from fastapi import APIRouter
from app.core.chroma_client import task_outcomes_collection, goals_collection

router = APIRouter()

@router.get("/debug/chroma")
def chroma_status():
    task_count = task_outcomes_collection.count()
    goal_count = goals_collection.count()

    task_samples = []
    if task_count > 0:
        results = task_outcomes_collection.peek(limit=10)
        for i in range(len(results["ids"])):
            task_samples.append({
                "id": results["ids"][i],
                "document": results["documents"][i],
                "metadata": results["metadatas"][i],
            })

    goal_samples = []
    if goal_count > 0:
        results = goals_collection.peek(limit=10)
        for i in range(len(results["ids"])):
            goal_samples.append({
                "id": results["ids"][i],
                "document": results["documents"][i],
                "metadata": results["metadatas"][i],
            })

    return {
        "task_outcomes": {"total_vectors": task_count, "samples": task_samples},
        "goals": {"total_vectors": goal_count, "samples": goal_samples},
    }