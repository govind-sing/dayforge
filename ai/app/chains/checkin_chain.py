import json
from datetime import datetime, timedelta
import zoneinfo
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from app.core.config import settings
from app.core.supabase_client import supabase

llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.4,
)


def resolve_date(date_str: str, today: str, tz_name: str) -> str:
    """Convert natural language date to YYYY-MM-DD."""
    now = datetime.now(zoneinfo.ZoneInfo(tz_name))
    date_str = date_str.strip().lower()

    if date_str in ("today", ""):
        return today
    elif date_str == "yesterday":
        return (now - timedelta(days=1)).strftime("%Y-%m-%d")
    elif date_str == "tomorrow":
        return (now + timedelta(days=1)).strftime("%Y-%m-%d")
    elif date_str.startswith("last "):
        day_name = date_str.replace("last ", "")
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        if day_name in days:
            target = days.index(day_name)
            current = now.weekday()
            delta = (current - target) % 7 or 7
            return (now - timedelta(days=delta)).strftime("%Y-%m-%d")
    # Already YYYY-MM-DD
    return date_str


checkin_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are Jarvis, an intelligent daily planning assistant embedded in DayForge.
You help users manage their day through chat — adding tasks, generating schedules, marking things done, rescheduling, and reviewing past days.

TODAY'S SCHEDULE:
{schedule_context}

CURRENT TIME: {current_time}
TODAY'S DATE: {today_date}

You can take the following actions:

1. add_task — add a single task to today's list (no scheduling)
   params: title, priority ("high"/"medium"/"low"), estimated_minutes
   Ask if priority missing. Guess estimated_minutes if not given.

2. add_tasks — add multiple tasks in one go
   params: tasks (array of objects, each with title, priority, estimated_minutes, description?)
   Use when user mentions more than one task at once.

3. add_to_schedule — add a task AND place it on today's calendar
   params: title, priority, estimated_minutes, start_time? (HH:MM), end_time? (HH:MM), description?
   Pick next free slot if no time given.

4. generate_schedule — regenerate today's full schedule from scratch
   No params.

5. mark_complete — mark a task as done
   params: task_id — from schedule context. Ask if ambiguous.

6. reschedule — move a scheduled task to a new time (same day)
   params: schedule_item_id, new_start (HH:MM), new_end (HH:MM)

7. skip — drop a task from today
   params: task_id — from schedule context.

8. delete_task — permanently delete a task
   params: task_id — from schedule context or cross-day query result. Ask to confirm if not explicit.

9. get_tasks — pending/incomplete tasks for today
   No params. Signal: message = "FETCHING_TASKS"

10. get_all_tasks — all tasks with status for today
    No params. Signal: message = "FETCHING_ALL_TASKS"

11. get_free_slots — free time slots remaining today after current time
    No params. Signal: message = "FETCHING_FREE_SLOTS"

12. get_tasks_by_date — get tasks from any date
    params: date (natural language or YYYY-MM-DD: "yesterday", "last monday", "june 19", "2026-06-19"), status_filter ("pending"/"completed"/"skipped"/"all", default "all")
    Signal: message = "FETCHING_TASKS_BY_DATE"

13. move_tasks_to_today — move tasks from another day to today (resets to pending)
    params: task_ids (array of task id strings)

14. get_history_by_date — what happened on a specific date (schedule + blocked slots)
    params: date (natural language or YYYY-MM-DD), from_time? (HH:MM), to_time? (HH:MM)
    Signal: message = "FETCHING_HISTORY"

15. general_reply — anything else, follow-ups, motivation, help

15. add_goal — add a long-term goal
    params: title, description?, deadline? (YYYY-MM-DD)
    Always confirm what you're adding. Ask for deadline if not given — but it's optional.

16. delete_goal — permanently delete a goal
    params: goal_id
    ALWAYS ask for confirmation first using general_reply before firing this action.
    Use get_all_goals first if goal_id is unknown.

17. extend_deadline — extend a goal's deadline
    params: goal_id, new_deadline (YYYY-MM-DD)
    ALWAYS ask why before extending. If reason feels genuine, proceed.
    If reason is weak (no explanation, vague, or just "I need more time"), extend anyway
    but add a note in your message that this will affect their alignment score.
    Use get_all_goals first if goal_id is unknown.

18. get_all_goals — list all user goals with deadlines and IDs
    No params. Signal: message = "FETCHING_GOALS"

19. get_goal_progress — show completed + skipped tasks aligned with a goal over past N days
    params: goal_name (natural language), days (default 7)
    Signal: message = "FETCHING_GOAL_PROGRESS"

NATURAL DATE RULES:
- "yesterday" → previous day
- "last monday" / "last week tuesday" → most recent that weekday
- "june 19" / "19 june" → assume current year
- Always convert to YYYY-MM-DD in params
- For add_to_schedule: only set title, priority, estimated_minutes in params. The system will check if the task already exists by title and reuse it. Only create new if user explicitly says "new task".

IMPORTANT RULES:
- Always pick task_id and schedule_item_id from schedule context — never make them up.
- For cross-day task_ids, they come from previous get_tasks_by_date results in conversation history.
- If you need more info, use general_reply and ask.
- Be concise and friendly. One or two sentences max in message.
- CRITICAL: Only execute an action for the CURRENT user message. Never re-execute from history.
- When action is generate_schedule, message = "On it! Generating your schedule now."
- For signal actions use exactly the signal string — system handles the reply.
- If user asks "what can you do" or "help": list all capabilities with examples in a friendly format.
- If user asks to list/show tasks with status: use get_all_tasks.
- If user asks what's pending/left/missed: use get_tasks.
- Always return an "actions" array, even for a single action. Never return a single action object.
- The "message" field is ONE summary for all actions combined, not per action.
- CRITICAL: Only execute actions for the CURRENT user message. Never re-execute from history.

Respond ONLY with a valid JSON object. No markdown fences.
Format:
Respond ONLY with a valid JSON object. No markdown fences.
Format:
{{
  "actions": [
    {{
      "action": "add_task" | "add_tasks" | "add_to_schedule" | "generate_schedule" | "mark_complete" | "reschedule" | "skip" | "delete_task" | "get_tasks" | "get_all_tasks" | "get_free_slots" | "get_tasks_by_date" | "move_tasks_to_today" | "get_history_by_date" | "general_reply" | "add_goal" | "delete_goal" | "extend_deadline" | "get_all_goals" | "get_goal_progress",
      "params": {{
        "title": "<if add_task or add_to_schedule>",
        "priority": "<if add_task or add_to_schedule>",
        "estimated_minutes": <if add_task or add_to_schedule>,
        "description": "<optional>",
        "start_time": "<HH:MM if add_to_schedule>",
        "end_time": "<HH:MM if add_to_schedule>",
        "tasks": [ {{ "title": "", "priority": "", "estimated_minutes": 0 }} ],
        "task_id": "<if mark_complete, skip, delete_task>",
        "task_ids": ["<if move_tasks_to_today>"],
        "schedule_item_id": "<if reschedule>",
        "new_start": "<HH:MM if reschedule>",
        "new_end": "<HH:MM if reschedule>",
        "date": "<YYYY-MM-DD for cross-day actions>",
        "status_filter": "<if get_tasks_by_date>",
        "from_time": "<HH:MM if get_history_by_date>",
        "to_time": "<HH:MM if get_history_by_date>"
        "goal_id": "<if delete_goal or extend_deadline>",
        "goal_name": "<if get_goal_progress>",
        "new_deadline": "<YYYY-MM-DD if extend_deadline>",
        "days": <number, if get_goal_progress>,
        "title": "<if add_goal>",
        "description": "<if add_goal>",
        "deadline": "<YYYY-MM-DD if add_goal>"
      }}
    }}
  ],
  "message": "<single friendly summary of everything you're doing>"
}}"""),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}"),
])

checkin_chain = checkin_prompt | llm | StrOutputParser()


def get_goal_progress(user_id: str, goal_name: str, days: int, tz_name: str) -> str:
    from app.core.chroma_client import goals_collection

    # 1. Find the goal by semantic match
    try:
        results = goals_collection.query(
            query_texts=[goal_name],
            n_results=1,
            where={"user_id": user_id},
            include=["metadatas", "distances"],
        )
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        if not metadatas or distances[0] > 0.7:
            return f"Couldn't find a goal matching '{goal_name}'. Try being more specific."
        matched_goal_title = metadatas[0]["title"]
        matched_goal_id = metadatas[0]["goal_id"]
    except Exception:
        return "Couldn't look up goals right now."

    # 2. Fetch completed + skipped task_events for past X days
    now = datetime.now(zoneinfo.ZoneInfo(tz_name))
    from_date = (now - timedelta(days=days)).strftime("%Y-%m-%d")

    result = supabase.table("task_events") \
        .select("task_title, event_type, scheduled_date, scheduled_start, task_id") \
        .eq("user_id", user_id) \
        .in_("event_type", ["completed", "skipped"]) \
        .gte("scheduled_date", from_date) \
        .execute()

    if not result.data:
        return f"No activity found in the past {days} days."

    # 3. Filter by goal alignment using ChromaDB
    aligned = []
    for row in result.data:
        try:
            res = goals_collection.query(
                query_texts=[row["task_title"]],
                n_results=1,
                where={"user_id": user_id},
                include=["metadatas", "distances"],
            )
            dists = res.get("distances", [[]])[0]
            metas = res.get("metadatas", [[]])[0]
            if dists and dists[0] < 0.5 and metas[0]["goal_id"] == matched_goal_id:
                aligned.append(row)
        except Exception:
            continue

    if not aligned:
        return f"No tasks aligned with '{matched_goal_title}' found in the past {days} days."

    # 4. Format response
    completed = [r for r in aligned if r["event_type"] == "completed"]
    skipped = [r for r in aligned if r["event_type"] == "skipped"]

    lines = [f"Progress toward '{matched_goal_title}' — past {days} days:\n"]

    if completed:
        lines.append(f"✅ Completed ({len(completed)}):")
        for r in completed:
            lines.append(f"  - {r['task_title']} on {r['scheduled_date']}")

    if skipped:
        lines.append(f"\n⏭️ Planned but skipped ({len(skipped)}):")
        for r in skipped:
            lines.append(f"  - {r['task_title']} on {r['scheduled_date']}")

    return "\n".join(lines)


def get_all_goals(user_id: str) -> str:
    result = supabase.table("goals") \
        .select("id, title, description, deadline") \
        .eq("user_id", user_id) \
        .order("created_at") \
        .execute()

    if not result.data:
        return "You have no goals yet. Tell me what you're working toward and I'll add it."

    lines = ["Your goals:"]
    for g in result.data:
        deadline = f" — due {g['deadline']}" if g["deadline"] else ""
        desc = f"\n    {g['description']}" if g["description"] else ""
        lines.append(f"- {g['title']}{deadline} [id: {g['id']}]{desc}")

    return "\n".join(lines)

def load_conversation_history(session_id: str) -> list:
    response = supabase.table("checkin_messages") \
        .select("role, content") \
        .eq("session_id", session_id) \
        .order("created_at") \
        .execute()

    history = []
    for msg in response.data:
        if msg["role"] == "user":
            history.append(HumanMessage(content=msg["content"]))
        else:
            history.append(AIMessage(content=msg["content"]))
    return history


def save_messages(session_id: str, user_id: str, user_content: str, ai_content: str):
    supabase.table("checkin_messages").insert([
        {"session_id": session_id, "user_id": user_id, "role": "user", "content": user_content},
        {"session_id": session_id, "user_id": user_id, "role": "assistant", "content": ai_content},
    ]).execute()


def get_pending_tasks(user_id: str, plan_date: str, tz_name: str) -> str:
    result = supabase.table("tasks") \
        .select("id, title, priority, estimated_minutes, status") \
        .eq("user_id", user_id) \
        .eq("original_date", plan_date) \
        .neq("status", "completed") \
        .execute()

    if not result.data:
        return "No pending tasks for today."

    lines = []
    for t in result.data:
        lines.append(
            f"- [{t['priority'].upper()}] {t['title']} ({t['estimated_minutes']} mins) — {t['status']}"
        )
    return "Pending tasks for today:\n" + "\n".join(lines)


def get_all_tasks(user_id: str, plan_date: str) -> str:
    result = supabase.table("tasks") \
        .select("title, priority, estimated_minutes, status") \
        .eq("user_id", user_id) \
        .eq("original_date", plan_date) \
        .execute()

    if not result.data:
        return "No tasks found for today."

    status_emoji = {
        "completed": "✅", "scheduled": "🕐",
        "pending": "⏳", "skipped": "⏭️", "in_progress": "🔄",
    }
    lines = []
    for t in result.data:
        emoji = status_emoji.get(t["status"], "•")
        lines.append(f"{emoji} [{t['priority'].upper()}] {t['title']} ({t['estimated_minutes']} mins)")

    return "Today's tasks:\n" + "\n".join(lines)


def get_free_slots(schedule_context: str, plan_date: str, tz_name: str, work_end: str) -> str:
    now = datetime.now(zoneinfo.ZoneInfo(tz_name))
    current_time = now.strftime("%H:%M")

    busy = []
    for line in schedule_context.split("\n"):
        if line.startswith("- ") and "–" in line:
            try:
                time_part = line.split(": ")[0].replace("- ", "").strip()
                start_str, end_str = time_part.split("–")
                busy.append((start_str.strip(), end_str.strip()))
            except Exception:
                continue

    busy.sort()
    cursor = current_time
    free = []

    for start, end in busy:
        if end <= cursor:
            continue
        if start > cursor:
            free.append(f"{cursor}–{start}")
        cursor = max(cursor, end)

    if cursor < work_end[:5]:
        free.append(f"{cursor}–{work_end[:5]}")

    if not free:
        return "No free slots remaining today."

    return "Free slots remaining today:\n" + "\n".join(f"- {s}" for s in free)


def get_tasks_by_date(user_id: str, date: str, status_filter: str, today: str, tz_name: str) -> str:
    resolved = resolve_date(date, today, tz_name)

    query = supabase.table("tasks") \
        .select("id, title, priority, estimated_minutes, status") \
        .eq("user_id", user_id) \
        .eq("original_date", resolved)

    # "pending" means not completed — includes both pending and scheduled
    if status_filter == "completed":
        query = query.eq("status", "completed")
    elif status_filter == "skipped":
        query = query.eq("status", "skipped")
    elif status_filter in ("pending", "incomplete"):
        query = query.in_("status", ["pending", "scheduled"])
    # "all" or anything else — no filter

    result = query.execute()

    if not result.data:
        return f"No tasks found for {resolved}."

    status_emoji = {
        "completed": "✅", "scheduled": "🕐",
        "pending": "⏳", "skipped": "⏭️", "in_progress": "🔄",
    }
    lines = []
    for t in result.data:
        emoji = status_emoji.get(t["status"], "•")
        lines.append(
            f"{emoji} [{t['priority'].upper()}] {t['title']} ({t['estimated_minutes']} mins) [id: {t['id']}]"
        )

    return f"Tasks for {resolved}:\n" + "\n".join(lines)

def get_history_by_date(user_id: str, date: str, from_time: str | None, to_time: str | None, today: str, tz_name: str) -> str:
    resolved = resolve_date(date, today, tz_name)

    def overlaps(start: str, end: str) -> bool:
        """Check if a task overlaps the requested time window."""
        if from_time and to_time:
            return start < to_time and end > from_time
        elif from_time:
            return end > from_time
        elif to_time:
            return start < to_time
        return True

    # Fetch schedule items
    plan = supabase.table("daily_plans") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("plan_date", resolved) \
        .execute()

    schedule_lines = []
    if plan.data:
        plan_id = plan.data[0]["id"]
        items = supabase.table("schedule_items") \
            .select("scheduled_start, scheduled_end, tasks(title, priority, status)") \
            .eq("plan_id", plan_id) \
            .order("scheduled_start") \
            .execute()

        for item in items.data:
            start = item["scheduled_start"][11:16]
            end = item["scheduled_end"][11:16]
            if not overlaps(start, end):
                continue
            title = item["tasks"]["title"]
            status = item["tasks"]["status"]
            schedule_lines.append(f"- {start}–{end}: {title} ({status})")

    # Fetch blocked slots
    slots = supabase.table("blocked_slots") \
        .select("label, start_time, end_time") \
        .eq("user_id", user_id) \
        .eq("active_from", resolved) \
        .execute()

    slot_lines = []
    for s in slots.data:
        start = str(s["start_time"])[:5]
        end = str(s["end_time"])[:5]
        if not overlaps(start, end):
            continue
        slot_lines.append(f"- {start}–{end}: {s['label']} (blocked)")

    if not schedule_lines and not slot_lines:
        time_range = f" from {from_time} to {to_time}" if from_time and to_time else ""
        return f"No activity found for {resolved}{time_range}."

    result = f"Activity on {resolved}:\n"
    if schedule_lines:
        result += "\nScheduled tasks:\n" + "\n".join(schedule_lines)
    if slot_lines:
        result += "\nBlocked slots:\n" + "\n".join(slot_lines)
    return result
async def run_checkin_chain(
    session_id: str,
    user_id: str,
    user_message: str,
    schedule_context: str,
    tz_name: str,
    plan_date: str,
    work_end: str,
) -> dict:
    history = load_conversation_history(session_id)
    now = datetime.now(zoneinfo.ZoneInfo(tz_name))
    current_time = now.strftime("%H:%M")
    today_date = now.strftime("%Y-%m-%d")

    raw_output = await checkin_chain.ainvoke({
        "schedule_context": schedule_context,
        "current_time": current_time,
        "today_date": today_date,
        "history": history,
        "input": user_message,
    })

    cleaned = raw_output.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()

    parsed = json.loads(cleaned)

    # Handle signal-based read actions — replace message in-place
    actions = parsed.get("actions", [])
    for i, a in enumerate(actions):
        action = a.get("action")
        params = a.get("params", {})

        if action == "get_tasks":
            actions[i]["_result"] = get_pending_tasks(user_id, plan_date, tz_name)
        elif action == "get_all_tasks":
            actions[i]["_result"] = get_all_tasks(user_id, plan_date)
        elif action == "get_free_slots":
            actions[i]["_result"] = get_free_slots(schedule_context, plan_date, tz_name, work_end)
        elif action == "get_tasks_by_date":
            actions[i]["_result"] = get_tasks_by_date(
                user_id, params.get("date", "today"),
                params.get("status_filter", "all"), today_date, tz_name,
            )
        elif action == "get_history_by_date":
            actions[i]["_result"] = get_history_by_date(
                user_id, params.get("date", "today"),
                params.get("from_time"), params.get("to_time"),
                today_date, tz_name,
            )
        elif action == "get_goal_progress":
            actions[i]["_result"] = get_goal_progress(
                user_id,
                params.get("goal_name", ""),
                params.get("days", 7),
                tz_name,
            )
        elif action == "get_all_goals":
            actions[i]["_result"] = get_all_goals(user_id)

    parsed["actions"] = actions

    # If all actions are read-only (have _result), build message from results
    results = [a["_result"] for a in actions if "_result" in a]
    if results:
        parsed["message"] = "\n\n".join(results)

    save_messages(session_id, user_id, user_message, parsed["message"])
    return parsed