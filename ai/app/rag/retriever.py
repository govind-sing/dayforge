from app.rag.embedder import get_embedding
from app.core.chroma_client import task_outcomes_collection, goals_collection


def get_past_patterns(user_id: str, task_titles: list[str], n_results: int = 3) -> str:
    if not task_titles:
        return ""

    # 1. Query once per task title, collect all results
    all_docs = []
    seen = set()

    for title in task_titles:
        try:
            embedding = get_embedding(title)
            results = task_outcomes_collection.query(
                query_embeddings=[embedding],
                n_results=n_results,
                where={"user_id": user_id},
            )

            docs = results.get("documents", [[]])[0]
            for doc in docs:
                if doc not in seen:
                    seen.add(doc)
                    all_docs.append(doc)

        except Exception:
            # If no results exist yet for this user, ChromaDB raises — skip cleanly
            continue

    if not all_docs:
        return ""

    # 2. Format as a context block for the schedule prompt
    lines = "\n".join(f"- {doc}" for doc in all_docs)
    return f"PAST SCHEDULING PATTERNS (learn from these):\n{lines}"




def get_aligned_goals(user_id: str, task_titles: list[str], threshold: float = 0.5) -> str:
    if not task_titles:
        return ""

    # 1. Query goals collection with each task title
    task_goal_pairs = []
    seen = set()

    for title in task_titles:
        try:
            embedding = get_embedding(title)
            results = goals_collection.query(
                query_embeddings=[embedding],
                n_results=1,
                where={"user_id": user_id},
                include=["documents", "metadatas", "distances"],
            )

            distances = results.get("distances", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]

            if not distances:
                continue

            # ChromaDB returns L2 distances — lower = more similar
            # 0.5 threshold filters out weak matches cleanly
            if distances[0] < threshold:
                goal_title = metadatas[0]["title"]
                pair = f"{title} → {goal_title}"
                if pair not in seen:
                    seen.add(pair)
                    task_goal_pairs.append(pair)

        except Exception:
            continue

    if not task_goal_pairs:
        return ""

    lines = "\n".join(f"- {pair}" for pair in task_goal_pairs)
    return f"GOAL ALIGNMENT (tasks mapped to user's goals — prioritize these):\n{lines}"