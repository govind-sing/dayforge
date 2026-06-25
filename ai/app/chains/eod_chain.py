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
    temperature=0.7,  # slightly higher — EOD is conversational, not structured
)

eod_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are Jarvis, a personal accountability mirror. It's end of day.
Your job is to walk through the user's day with them — not audit them, not judge them. Just reflect honestly and listen.

TODAY'S TIMELINE:
{day_timeline}

WORK HOURS: {work_start} to {work_end}
CURRENT TIME: {current_time}
TODAY'S DATE: {today_date}

HOW TO WALK THROUGH THE DAY:
The timeline above shows the full day — scheduled tasks with their times and statuses, and free gaps between them.
Walk through it chronologically from work_start to work_end. One block at a time. Never jump ahead.

For each TASK block:
- If completed → acknowledge it briefly and move on. "You got X done — good."
- If incomplete or skipped → ask if they worked on it at all, even partially.
  Wait for answer. If yes → ask roughly how long.
  If no → ask what got in the way. One follow-up max. Don't lecture.

For each FREE GAP (>= 30 mins):
- Ask naturally what they did during that time. Don't say "I notice you had free time 2-9pm".
  Just ask like a friend would — "what were you up to between 2 and 9?"
- React to what they say. If they say "cricket" don't just say "noted". Say something real.
- One follow-up if something is interesting or needs warmth.

After the full timeline is walked:
- Open mic: ask "anything else on your mind about today?"
- Wait for their reply. React genuinely to what they say — ask one follow-up if something is interesting.
- Only after they respond to your follow-up OR explicitly say they're done, fire save_eod_summary.
- NEVER fire save_eod_summary in the same turn as the open mic question.
- NEVER fire save_eod_summary immediately after the user's first open mic reply — always respond first.

CRITICAL RULES:
- One question at a time. Always wait for the user's reply before moving to the next block.
- Never ask two things in one message.
- Never say "I noted that" or "I logged" or "I saved". Be invisible about logging.
- React like a human friend, not a form.
- Keep messages short — 1-3 sentences max.
- Never moralize or lecture about missed tasks.
- The goal is honest reflection, not productivity guilt.

ACTIONS YOU CAN TAKE:
1. general_reply — talking, asking, reacting. Most messages will be this.

2. log_unstructured — silently log what user shares
   params: content (what they said), log_type ("skip_reason" / "actual_hours" / "free_slot" / "open_reflection"), task_id (if about a specific task, else omit)
   When to use:
   - User explains why they missed a task → log_type: "skip_reason", include task_id
   - User says they partially worked on something → log_type: "actual_hours", content as JSON: {{"hours": 1.5, "note": "what they said"}}, include task_id
   - User says what they did in free time → log_type: "free_slot"
   - User shares something in open mic → log_type: "open_reflection"
   Always fire silently alongside general_reply. Never mention it.

3. save_eod_summary — save the day summary. Fire only once, at the very end after open mic exchange.
   params: summary (2-3 paragraph honest summary — what got done, what didn't and why, how free time was spent, what user shared)
   After this, close warmly. Nothing about saving.

Respond ONLY with valid JSON. No markdown fences.
{{
  "actions": [
    {{
      "action": "general_reply" | "log_unstructured" | "save_eod_summary",
      "params": {{
        "content": "<if log_unstructured>",
        "log_type": "<skip_reason|actual_hours|free_slot|open_reflection>",
        "task_id": "<if log_unstructured and about a specific task>",
        "summary": "<if save_eod_summary>"
      }}
    }}
  ],
  "message": "<what Jarvis says to the user>"
}}"""),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}"),
])

eod_chain = eod_prompt | llm | StrOutputParser()


def build_day_timeline(user_id: str, plan_date: str, work_start: str, work_end: str) -> str:
    """
    Build a chronological timeline of the day:
    scheduled task blocks + free gaps between them.
    """

    plan = supabase.table("daily_plans") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("plan_date", plan_date) \
        .execute()

    if not plan.data:
        return f"No schedule found for today. Work hours: {work_start}–{work_end}."

    plan_id = plan.data[0]["id"]

    items = supabase.table("schedule_items") \
        .select("task_id, scheduled_start, scheduled_end, tasks(id, title, status, estimated_minutes)") \
        .eq("plan_id", plan_id) \
        .order("scheduled_start") \
        .execute()

    if not items.data:
        return f"Schedule exists but no tasks were planned. Work hours: {work_start}–{work_end}."

    # Also fetch all tasks for today to catch pending ones not in schedule
    all_tasks = supabase.table("tasks") \
        .select("id, title, status, estimated_minutes, priority") \
        .eq("user_id", user_id) \
        .eq("original_date", plan_date) \
        .execute()

    task_status_map = {t["id"]: t["status"] for t in (all_tasks.data or [])}

    blocks = []
    for item in items.data:
        start = item["scheduled_start"][11:16]
        end = item["scheduled_end"][11:16]
        task = item["tasks"]
        # Use task table status as source of truth
        status = task_status_map.get(task["id"], task["status"])
        blocks.append({
            "type": "task",
            "start": start,
            "end": end,
            "task_id": task["id"],
            "title": task["title"],
            "status": status,
        })

    # Sort by start time
    blocks.sort(key=lambda x: x["start"])

    # Build timeline with gaps
    timeline_lines = [f"Work hours: {work_start}–{work_end}\n"]
    cursor = work_start

    for block in blocks:
        # Gap before this task
        if block["start"] > cursor:
            gap_mins = (
                datetime.strptime(block["start"], "%H:%M") -
                datetime.strptime(cursor, "%H:%M")
            ).seconds // 60
            if gap_mins >= 30:
                timeline_lines.append(f"[FREE] {cursor}–{block['start']} ({gap_mins} mins)")

        # Task block
        status_label = {
            "completed": "✅ completed",
            "skipped": "⏭️ skipped",
            "pending": "⏳ not done",
            "scheduled": "⏳ not done",
        }.get(block["status"], block["status"])

        timeline_lines.append(
            f"[TASK] {block['start']}–{block['end']}: {block['title']} — {status_label} [task_id: {block['task_id']}]"
        )
        cursor = block["end"]

    # Gap after last task
    if cursor < work_end:
        gap_mins = (
            datetime.strptime(work_end, "%H:%M") -
            datetime.strptime(cursor, "%H:%M")
        ).seconds // 60
        if gap_mins >= 30:
            timeline_lines.append(f"[FREE] {cursor}–{work_end} ({gap_mins} mins)")

    return "\n".join(timeline_lines)


def load_eod_history(session_id: str) -> list:
    response = supabase.table("checkin_messages") \
        .select("role, content") \
        .eq("session_id", session_id) \
        .eq("message_type", "eod") \
        .order("created_at") \
        .execute()

    history = []
    for msg in response.data:
        if msg["role"] == "user":
            history.append(HumanMessage(content=msg["content"]))
        else:
            history.append(AIMessage(content=msg["content"]))
    return history


def save_eod_messages(session_id: str, user_id: str, user_content: str, ai_content: str):
    supabase.table("checkin_messages").insert([
        {"session_id": session_id, "user_id": user_id, "role": "user", "content": user_content, "message_type": "eod"},
        {"session_id": session_id, "user_id": user_id, "role": "assistant", "content": ai_content, "message_type": "eod"},
    ]).execute()


async def run_eod_chain(
    session_id: str,
    user_id: str,
    user_message: str,
    plan_date: str,
    work_start: str,
    work_end: str,
    tz_name: str,
) -> dict:
    now = datetime.now(zoneinfo.ZoneInfo(tz_name))
    current_time = now.strftime("%H:%M")
    today_date = now.strftime("%Y-%m-%d")

    # Time gate — must be within 1 hour of work_end
    work_end_dt = datetime.strptime(work_end, "%H:%M")
    gate_time = (work_end_dt - timedelta(hours=1)).strftime("%H:%M")

    if current_time < gate_time:
        return {
            "actions": [{"action": "general_reply", "params": {}}],
            "message": f"EOD reflection is available from {gate_time} onwards. Come back then and we'll wrap up the day properly.",
            "eod_blocked": True,
        }

    # Build timeline fresh each time (status may have changed)
    day_timeline = build_day_timeline(user_id, plan_date, work_start, work_end)

    history = load_eod_history(session_id)

    print("=== EOD CHAIN ===")
    print(f"TIMELINE:\n{day_timeline}")
    print(f"CURRENT TIME: {current_time}")
    print(f"HISTORY LENGTH: {len(history)}")
    print("=================")

    raw_output = await eod_chain.ainvoke({
        "day_timeline": day_timeline,
        "work_start": work_start,
        "work_end": work_end,
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
    save_eod_messages(session_id, user_id, user_message, parsed["message"])
    return parsed

