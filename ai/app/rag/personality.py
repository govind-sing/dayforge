from datetime import datetime, timedelta
import zoneinfo
from app.core.supabase_client import supabase
from collections import Counter


def get_personality_insights(user_id: str, tz_name: str) -> str:
    now = datetime.now(zoneinfo.ZoneInfo(tz_name))
    from_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")

    # 1. Fetch task_events
    events = supabase.table("task_events") \
        .select("task_title, priority, event_type, scheduled_date") \
        .eq("user_id", user_id) \
        .gte("scheduled_date", from_date) \
        .execute()

    # 2. Fetch unstructured_logs
    logs = supabase.table("unstructured_logs") \
        .select("content, log_type, date") \
        .eq("user_id", user_id) \
        .gte("date", from_date) \
        .execute()

    if not events.data and not logs.data:
        return ""

    rows = events.data or []
    log_rows = logs.data or []

    # --- Avoidance patterns ---
    skipped_deleted = [r["task_title"] for r in rows if r["event_type"] in ("skipped", "deleted")]
    avoidance_counts = Counter(skipped_deleted)
    avoided = [title for title, count in avoidance_counts.items() if count >= 2]

    # --- Deep work capacity ---
    high_total = [r for r in rows if r["priority"] == "high"]
    high_done = [r for r in high_total if r["event_type"] == "completed"]
    high_rate = round(len(high_done) / len(high_total) * 100) if high_total else None

    low_med_total = [r for r in rows if r["priority"] in ("medium", "low")]
    low_med_done = [r for r in low_med_total if r["event_type"] == "completed"]
    low_med_rate = round(len(low_med_done) / len(low_med_total) * 100) if low_med_total else None

    # --- Free time quality ---
    free_slot_logs = [l["content"] for l in log_rows if l["log_type"] == "free_slot"]

    # --- Consistency ---
    completed_dates = set(r["scheduled_date"] for r in rows if r["event_type"] == "completed")
    streak = 0
    for i in range(30):
        date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        if date in completed_dates:
            streak += 1
        else:
            break

    # --- Build context string ---
    lines = ["PERSONALITY INSIGHTS (past 30 days):"]

    if avoided:
        lines.append(f"Avoidance: These tasks keep getting skipped or deleted — {', '.join(avoided[:5])}.")

    if high_rate is not None:
        lines.append(f"Deep work capacity: {high_rate}% of high priority tasks completed.")
        if low_med_rate is not None:
            lines.append(f"Medium/low priority completion: {low_med_rate}%.")

    if free_slot_logs:
        lines.append(f"Free time (last {len(free_slot_logs)} logged slots): {' | '.join(free_slot_logs[:5])}")

    if streak > 0:
        lines.append(f"Consistency streak: {streak} day(s) in a row with at least one completed task.")
    else:
        lines.append("Consistency: No completed tasks yesterday — streak broken.")

    return "\n".join(lines)