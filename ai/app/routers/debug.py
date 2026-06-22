from fastapi import APIRouter
from app.core.chroma_client import task_outcomes_collection

router = APIRouter()

@router.get("/debug/chroma")
def chroma_status():
    count = task_outcomes_collection.count()
    
    # Peek at first 10 documents if any exist
    if count == 0:
        return {"total_vectors": 0, "samples": []}
    
    results = task_outcomes_collection.peek(limit=10)
    
    samples = []
    for i in range(len(results["ids"])):
        samples.append({
            "id": results["ids"][i],
            "document": results["documents"][i],
            "metadata": results["metadatas"][i],
        })
    
    return {"total_vectors": count, "samples": samples}