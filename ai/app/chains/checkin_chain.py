import json
from datetime import datetime
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

checkin_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are Jarvis, an intelligent daily planning assistant embedded in DayForge.
You help users manage their day through chat — adding tasks, generating schedules, marking things done, and rescheduling.

TODAY'S SCHEDULE:
{schedule_context}

CURRENT TIME: {current_time}

You can take the following actions:

1. add_task — user wants to add a task to their list only (no scheduling yet)
   Required params: title, priority ("high"/"medium"/"low"), estimated_minutes
   If priority is missing, ask for it. If estimated_minutes missing, make a reasonable guess.

2. add_to_schedule — user wants to add a task AND place it on today's calendar
   Required params: title, priority, estimated_minutes
   Optional params: start_time (HH:MM), end_time (HH:MM)
   If user gives a time range use it. If not, pick the next free slot after current time from the schedule context.
   description should capture any time preference the user mentioned.

3. generate_schedule — user wants to regenerate today's full schedule from scratch
   No params needed.

4. mark_complete — user says a task is done
   Required params: task_id — pick from schedule context. If ambiguous, ask.

5. reschedule — user wants to move a scheduled task to a new time
   Required params: schedule_item_id, new_start (HH:MM), new_end (HH:MM)
   Pick schedule_item_id from schedule context. If ambiguous, ask.

6. skip — user wants to drop a task from today
   Required params: task_id — pick from schedule context.

7. get_tasks — user asks what's pending, what's left, what they missed
   No params. You will receive pending tasks in execution and reply with them.
   Use general_reply action with message "FETCHING_TASKS" as a signal — the system will replace this.

8. get_free_slots — user asks what time is free, what slots are available
   No params. You will receive free slots after current time in execution.
   Use general_reply action with message "FETCHING_FREE_SLOTS" as a signal — the system will replace this.

9. get_all_tasks — user wants to see all tasks with status, list today's tasks, cross check tasks
    No params. Use general_reply with message "FETCHING_ALL_TASKS" as signal.

10. general_reply — anything else
     
- If user asks "what can you do", "help", "commands", or similar, use general_reply and list your capabilities in a clean, friendly format like:
  "Here's what I can help you with:
  • Add a task — 'add a high priority task: review notes for 45 mins'
  • Schedule a task — 'add call with mentor to my schedule at 5pm for 30 mins'
  • Generate schedule — 'generate my schedule'
  • Mark complete — 'I finished my workout'
  • Reschedule — 'move gym to 7pm'
  • Skip a task — 'skip the movie today'
  • Pending tasks — 'what tasks are left?'
  • Free slots — 'what time is free today?'"

IMPORTANT RULES:
- Always pick task_id and schedule_item_id from schedule context — never make them up.
- If you need more info, use general_reply and ask.
- Be concise and friendly. One or two sentences max in message.
- Times are in user's local timezone. new_start/new_end/start_time/end_time should be HH:MM local time.
- CRITICAL: Only execute an action for the CURRENT user message. Never re-execute actions from conversation history.
- When action is generate_schedule, message must ONLY be a short confirmation like "On it! Generating your schedule now."
- For get_tasks and get_free_slots use exactly the signal strings specified — the system handles the actual reply.

Respond ONLY with a valid JSON object. No markdown fences.
Format:
{{
  "action": "add_task" | "add_to_schedule" | "generate_schedule" | "mark_complete" | "reschedule" | "skip" | "get_tasks" | "get_free_slots" | "general_reply",
  "message": "<your conversational reply or signal string>",
  "params": {{
    "title": "<if add_task or add_to_schedule>",
    "priority": "<if add_task or add_to_schedule>",
    "estimated_minutes": <if add_task or add_to_schedule>,
    "description": "<if add_to_schedule and user specified time preference>",
    "start_time": "<HH:MM if add_to_schedule and time given>",
    "end_time": "<HH:MM if add_to_schedule and time given>",
    "task_id": "<if mark_complete or skip>",
    "schedule_item_id": "<if reschedule>",
    "new_start": "<HH:MM if reschedule>",
    "new_end": "<HH:MM if reschedule>"
  }}
}}"""),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}"),
])

checkin_chain = checkin_prompt | llm | StrOutputParser()


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
    """Fetch pending/skipped tasks and tasks whose scheduled time has passed but aren't complete."""
    now = datetime.now(zoneinfo.ZoneInfo(tz_name))
    current_time = now.strftime("%H:%M")

    # Get all non-completed tasks for today
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
        status = t["status"]
        lines.append(
            f"- [{t['priority'].upper()}] {t['title']} ({t['estimated_minutes']} mins) — {status}"
        )

    return "Here are your remaining tasks for today:\n" + "\n".join(lines)

def get_all_tasks(user_id: str, plan_date: str) -> str:
    result = supabase.table("tasks") \
        .select("title, priority, estimated_minutes, status") \
        .eq("user_id", user_id) \
        .eq("original_date", plan_date) \
        .execute()

    if not result.data:
        return "No tasks found for today."

    lines = []
    for t in result.data:
        status_emoji = {
            "completed": "✅",
            "scheduled": "🕐",
            "pending": "⏳",
            "skipped": "⏭️",
            "in_progress": "🔄",
        }.get(t["status"], "•")
        lines.append(
            f"{status_emoji} [{t['priority'].upper()}] {t['title']} ({t['estimated_minutes']} mins)"
        )

    return "Here are today's tasks:\n" + "\n".join(lines)


def get_free_slots(schedule_context: str, plan_date: str, tz_name: str, work_end: str) -> str:
    """Calculate free slots after current time based on schedule context."""
    now = datetime.now(zoneinfo.ZoneInfo(tz_name))
    current_time = now.strftime("%H:%M")

    # Parse scheduled blocks from context
    busy = []
    for line in schedule_context.split("\n"):
        if line.startswith("- ") and "–" in line:
            try:
                time_part = line.split(": ")[0].replace("- ", "").strip()
                start_str, end_str = time_part.split("–")
                busy.append((start_str.strip(), end_str.strip()))
            except Exception:
                continue

    # Build free slots after current time
    busy.sort()
    cursor = current_time
    free = []

    for start, end in busy:
        if end <= cursor:
            continue
        if start > cursor:
            free.append(f"{cursor}–{start}")
        cursor = max(cursor, end)

    # Add remaining time until work_end
    if cursor < work_end:
        free.append(f"{cursor}–{work_end}")

    if not free:
        return "No free slots remaining today."

    return "Free slots remaining today:\n" + "\n".join(f"- {s}" for s in free)


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

    raw_output = await checkin_chain.ainvoke({
        "schedule_context": schedule_context,
        "current_time": current_time,
        "history": history,
        "input": user_message,
    })

    # print("=== SCHEDULE CONTEXT ===")
    # print(schedule_context)
    # print("=== CURRENT TIME ===")
    # print(current_time)
    # print("=== WORK END ===")
    # print(work_end)
    cleaned = raw_output.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()

    parsed = json.loads(cleaned)

    # Handle get_tasks and get_free_slots — system generates the reply
    if parsed.get("action") == "get_tasks" or parsed.get("message") == "FETCHING_TASKS":
        parsed["action"] = "general_reply"
        parsed["message"] = get_pending_tasks(user_id, plan_date, tz_name)

    elif parsed.get("action") == "get_free_slots" or parsed.get("message") == "FETCHING_FREE_SLOTS":
        parsed["action"] = "general_reply"
        parsed["message"] = get_free_slots(schedule_context, plan_date, tz_name, work_end)
    
    elif parsed.get("action") == "get_all_tasks" or parsed.get("message") == "FETCHING_ALL_TASKS":
        parsed["action"] = "general_reply"
        parsed["message"] = get_all_tasks(user_id, plan_date)

    save_messages(session_id, user_id, user_message, parsed["message"])

    return parsed