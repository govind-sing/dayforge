from datetime import date, timedelta, datetime
from app.core.supabase_client import supabase
from app.rag.embedder import get_embeddings_batch
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings
import json

llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.2,
)

ALIGNMENT_THRESHOLD = 0.75


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = sum(x ** 2 for x in a) ** 0.5
    mag_b = sum(x ** 2 for x in b) ** 0.5
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def get_goal_actual_hours(
    user_id: str,
    goal_title: str,
    goal_embedding: list[float],
    date_str: str
) -> float:
    """
    For a given goal and date, sum durations of completed schedule_items
    semantically aligned to the goal.
    Falls back to unstructured_logs for partial hours reported during EOD.
    """

    # 1. Fetch completed schedule_items for this user on this date
    response = supabase.table("schedule_items") \
        .select("task_id, scheduled_start, scheduled_end, tasks(title, status)") \
        .eq("user_id", user_id) \
        .gte("scheduled_start", f"{date_str}T00:00:00") \
        .lt("scheduled_start", f"{date_str}T23:59:59") \
        .execute()

    items = response.data or []

    completed = [
        item for item in items
        if item.get("tasks") and item["tasks"]["status"] == "completed"
    ]

    if completed:
        titles = [item["tasks"]["title"] for item in completed]
        embeddings = get_embeddings_batch(titles)

        total_minutes = 0.0
        for item, embedding in zip(completed, embeddings):
            score = cosine_similarity(embedding, goal_embedding)
            if score >= ALIGNMENT_THRESHOLD:
                start = datetime.fromisoformat(item["scheduled_start"])
                end = datetime.fromisoformat(item["scheduled_end"])
                total_minutes += (end - start).total_seconds() / 60

        actual_hours = total_minutes / 60
        if actual_hours > 0:
            return actual_hours

    # 2. Fallback — check unstructured_logs for EOD-reported partial hours
    return get_partial_hours_from_logs(user_id, goal_embedding, date_str)


def get_partial_hours_from_logs(
    user_id: str,
    goal_embedding: list[float],
    date_str: str
) -> float:
    """
    Check unstructured_logs for actual_hours entries reported during EOD
    that are semantically aligned to this goal.
    """

    response = supabase.table("unstructured_logs") \
        .select("content, task_id") \
        .eq("user_id", user_id) \
        .eq("date", date_str) \
        .eq("log_type", "actual_hours") \
        .execute()

    logs = response.data or []
    if not logs:
        return 0.0

    task_ids = [log["task_id"] for log in logs if log.get("task_id")]
    if not task_ids:
        return 0.0

    tasks_response = supabase.table("tasks") \
        .select("id, title") \
        .in_("id", task_ids) \
        .execute()

    tasks = {t["id"]: t["title"] for t in (tasks_response.data or [])}
    if not tasks:
        return 0.0

    task_id_list = list(tasks.keys())
    titles = [tasks[tid] for tid in task_id_list]
    embeddings = get_embeddings_batch(titles)

    aligned_task_ids = set()
    for task_id, embedding in zip(task_id_list, embeddings):
        score = cosine_similarity(embedding, goal_embedding)
        if score >= ALIGNMENT_THRESHOLD:
            aligned_task_ids.add(task_id)

    total_hours = 0.0
    for log in logs:
        if log.get("task_id") in aligned_task_ids:
            try:
                content = json.loads(log["content"])
                total_hours += float(content.get("hours", 0))
            except (json.JSONDecodeError, ValueError):
                pass

    return total_hours


def get_skip_score_for_date(
    user_id: str,
    goal_embedding: list[float],
    date_str: str
) -> float | None:
    """
    Check unstructured_logs for skip_reasons on this date aligned to this goal.
    Returns 50 if genuine reason found, 0 if excuse, None if no log found.
    This is sync — Gemini call is made via llm.invoke() not ainvoke.
    """

    response = supabase.table("unstructured_logs") \
        .select("content, task_id") \
        .eq("user_id", user_id) \
        .eq("date", date_str) \
        .eq("log_type", "skip_reason") \
        .execute()

    logs = response.data or []
    if not logs:
        return None

    task_ids = [log["task_id"] for log in logs if log.get("task_id")]
    if not task_ids:
        return None

    tasks_response = supabase.table("tasks") \
        .select("id, title") \
        .in_("id", task_ids) \
        .execute()

    tasks = {t["id"]: t["title"] for t in (tasks_response.data or [])}
    if not tasks:
        return None

    task_id_list = list(tasks.keys())
    titles = [tasks[tid] for tid in task_id_list]
    embeddings = get_embeddings_batch(titles)

    aligned_logs = []
    for task_id, embedding in zip(task_id_list, embeddings):
        score = cosine_similarity(embedding, goal_embedding)
        if score >= ALIGNMENT_THRESHOLD:
            for log in logs:
                if log.get("task_id") == task_id:
                    aligned_logs.append(log)

    if not aligned_logs:
        return None

    reason_text = aligned_logs[0]["content"]

    prompt = f"""A user missed a committed goal session. Their reason: "{reason_text}"
Is this a genuine reason or an excuse?
Reply with exactly one word: genuine or excuse."""

    result = llm.invoke(prompt)
    verdict = result.content.strip().lower()

    return 50.0 if verdict == "genuine" else 0.0


def compute_label(all_daily_scores: list[float]) -> str:
    """
    Compare recent half vs older half to determine trend.
    """
    if len(all_daily_scores) < 2:
        return "drifting"

    mid = len(all_daily_scores) // 2
    recent = all_daily_scores[:mid]
    previous = all_daily_scores[mid:]

    recent_avg = sum(recent) / len(recent)
    previous_avg = sum(previous) / len(previous)

    diff = recent_avg - previous_avg

    if diff > 5:
        return "improving"
    elif diff < -5:
        return "drifting"
    else:
        return "consistent"


async def generate_reason(score: float, label: str, goals: list) -> str:
    """
    Generate a Jarvis-style one sentence reason for the alignment score.
    """
    goal_titles = [g["title"] for g in goals]

    prompt = f"""You are Jarvis, a personal accountability assistant.
The user's alignment score is {score}% and their trend is '{label}'.
Their active goals are: {', '.join(goal_titles)}.
Write one short, honest, human sentence explaining why they got this score.
No fluff. No encouragement. Just the truth."""

    result = await llm.ainvoke(prompt)
    return result.content.strip()


async def get_alignment_score(user_id: str) -> dict | None:
    """
    Compute alignment score for the user based on last 14 days of committed goal days.
    Returns None if user has no goals.
    """

    # 1. Fetch all user goals
    goals_response = supabase.table("goals") \
        .select("id, title, committed_days, committed_hours") \
        .eq("user_id", user_id) \
        .execute()

    goals = goals_response.data or []
    if not goals:
        return None

    # 2. Last 14 days excluding today — we score past days only
    today = date.today()
    last_14_days = [today - timedelta(days=i) for i in range(1, 15)]


    # 3. Embed all goal titles in one batch
    goal_titles = [g["title"] for g in goals]
    goal_embeddings = get_embeddings_batch(goal_titles)

    # 4. Per goal, per committed day — compute daily score
    all_daily_scores = []

    for goal, goal_embedding in zip(goals, goal_embeddings):
        committed_days = [d.lower() for d in (goal["committed_days"] or [])]
        committed_hours = goal["committed_hours"] or 0

        if not committed_days or committed_hours == 0:
            continue

        for day in last_14_days:
            day_name = day.strftime("%a").lower()  # "mon", "tue" etc
            if day_name not in committed_days:
                continue  # not a committed day for this goal

            date_str = day.isoformat()

            actual_hours = get_goal_actual_hours(
                user_id, goal["title"], goal_embedding, date_str
            )

            if actual_hours > 0:
                raw_score = (actual_hours / committed_hours) * 100
                daily_score = min(raw_score, 120)
            else:
                skip_score = get_skip_score_for_date(user_id, goal_embedding, date_str)
                if skip_score is not None:
                    daily_score = skip_score  # 50 genuine, 0 excuse
                else:
                    daily_score = 0  # missed, no reason

            all_daily_scores.append(daily_score)

    if not all_daily_scores:
        return {
            "score": 0,
            "label": "drifting",
            "reason": "No activity logged against your goals yet."
        }

    overall_score = round(sum(all_daily_scores) / len(all_daily_scores), 1)
    label = compute_label(all_daily_scores)
    reason = await generate_reason(overall_score, label, goals)

    return {
        "score": overall_score,
        "label": label,
        "reason": reason
    }


def get_neglected_goals(user_id: str) -> list[dict]:
    """
    Returns goals where the user had a committed day today but
    has not scheduled any aligned task.
    Requires >= 3 committed days of history before flagging.
    """

    goals_response = supabase.table("goals") \
        .select("id, title, committed_days, committed_hours") \
        .eq("user_id", user_id) \
        .execute()

    goals = goals_response.data or []
    if not goals:
        return []

    today = date.today()
    today_name = today.strftime("%a").lower()
    today_str = today.isoformat()

    goal_titles = [g["title"] for g in goals]
    goal_embeddings = get_embeddings_batch(goal_titles)

    neglected = []

    for goal, goal_embedding in zip(goals, goal_embeddings):
        committed_days = [d.lower() for d in (goal["committed_days"] or [])]

        if today_name not in committed_days:
            continue  # not committed today, nothing to flag


        # Now check if anything aligned is scheduled for today
        actual_today = get_goal_actual_hours(
            user_id, goal["title"], goal_embedding, today_str
        )

        if actual_today == 0:
            neglected.append({
                "goal_id": goal["id"],
                "title": goal["title"],
                "committed_hours": goal["committed_hours"],
            })

    return neglected



async def save_goal_alignment_scores(user_id: str) -> None:
    """
    Compute and save per-goal alignment score into the goals table.
    Called at end of EOD flow.
    """

    goals_response = supabase.table("goals") \
        .select("id, title, committed_days, committed_hours") \
        .eq("user_id", user_id) \
        .execute()

    goals = goals_response.data or []
    if not goals:
        return

    today = date.today()
    last_14_days = [today - timedelta(days=i) for i in range(1, 15)]

    goal_titles = [g["title"] for g in goals]
    goal_embeddings = get_embeddings_batch(goal_titles)

    for goal, goal_embedding in zip(goals, goal_embeddings):
        committed_days = [d.lower() for d in (goal["committed_days"] or [])]
        committed_hours = goal["committed_hours"] or 0

        if not committed_days or committed_hours == 0:
            continue

        daily_scores = []

        for day in last_14_days:
            day_name = day.strftime("%a").lower()
            if day_name not in committed_days:
                continue

            date_str = day.isoformat()

            actual_hours = get_goal_actual_hours(
                user_id, goal["title"], goal_embedding, date_str
            )

            if actual_hours > 0:
                raw_score = (actual_hours / committed_hours) * 100
                daily_score = min(raw_score, 120)
            else:
                skip_score = get_skip_score_for_date(user_id, goal_embedding, date_str)
                if skip_score is not None:
                    daily_score = skip_score
                else:
                    daily_score = 0

            daily_scores.append(daily_score)

        if not daily_scores:
            continue

        goal_score = round(sum(daily_scores) / len(daily_scores), 1)

        supabase.table("goals").update({
            "alignment_score": goal_score,
            "alignment_updated_at": today.isoformat(),
        }).eq("id", goal["id"]) \
        .eq("user_id", user_id) \
        .execute()