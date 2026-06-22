from app.core.chroma_client import task_outcomes_collection


def get_past_patterns(user_id: str, task_titles: list[str], n_results: int = 3) -> str:
    if not task_titles:
        return ""

    # 1. Query once per task title, collect all results
    all_docs = []
    seen = set()

    for title in task_titles:
        try:
            results = task_outcomes_collection.query(
                query_texts=[title],
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