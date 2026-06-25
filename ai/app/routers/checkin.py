from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.supabase_client import supabase
from app.chains.checkin_chain import run_checkin_chain
from app.chains.schedule_chain import run_schedule_chain, save_schedule
from gotrue.errors import AuthApiError
from datetime import datetime, timedelta
from app.routers.schedule import build_schedule_request
from app.task_event_logger.task_event_logger import (
    log_completed, log_skipped, log_rescheduled, log_deleted
)
from app.rag.retriever import get_aligned_goals
from app.chains.eod_chain import run_eod_chain
import zoneinfo

router = APIRouter()


def get_user_profile(user_id: str) -> dict:
    result = supabase.table("profiles") \
        .select("timezone, work_start, work_end") \
        .eq("id", user_id) \
        .execute()
    if result.data:
        p = result.data[0]
        return {
            "timezone": p["timezone"],
            "work_start": str(p["work_start"])[:5],
            "work_end": str(p["work_end"])[:5],
        }
    return {"timezone": "Asia/Kolkata", "work_start": "07:00", "work_end": "22:00"}


def convert_utc_to_local(utc_timestamp: str, tz_name: str) -> str:
    return utc_timestamp[11:16]




def get_schedule_context(user_id: str, plan_date: str, tz_name: str) -> str:
    plan = supabase.table("daily_plans") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("plan_date", plan_date) \
        .execute()

    if not plan.data:
        return "No schedule generated for today yet."

    plan_id = plan.data[0]["id"]

    items = supabase.table("schedule_items") \
        .select("id, task_id, scheduled_start, scheduled_end, tasks(title, priority, status)") \
        .eq("plan_id", plan_id) \
        .order("position") \
        .execute()

    if not items.data:
        return "Schedule exists but has no items."

    lines = []
    for item in items.data:
        start = convert_utc_to_local(item["scheduled_start"], tz_name)
        end = convert_utc_to_local(item["scheduled_end"], tz_name)
        title = item["tasks"]["title"]
        priority = item["tasks"]["priority"]
        status = item["tasks"]["status"]
        lines.append(
            f"- {start}–{end}: {title} ({priority} priority, status: {status}) "
            f"[task_id: {item['task_id']}, schedule_item_id: {item['id']}]"
        )

    schedule_str = "\n".join(lines)

    # Fetch all task titles for goal alignment
    all_tasks = supabase.table("tasks") \
        .select("title") \
        .eq("user_id", user_id) \
        .eq("original_date", plan_date) \
        .execute()

    task_titles = [t["title"] for t in all_tasks.data] if all_tasks.data else []
    aligned_goals = get_aligned_goals(user_id=user_id, task_titles=task_titles)

    context = schedule_str
    if aligned_goals:
        context += f"\n\n{aligned_goals}"

    return context



def get_or_create_session(user_id: str, plan_date: str) -> str:
    existing = supabase.table("checkin_sessions") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("status", "active") \
        .gte("opened_at", f"{plan_date}T00:00:00+00:00") \
        .lte("opened_at", f"{plan_date}T23:59:59+00:00") \
        .execute()

    if existing.data:
        return existing.data[0]["id"]

    result = supabase.table("checkin_sessions").insert({
        "user_id": user_id,
        "status": "active",
    }).execute()
    return result.data[0]["id"]


async def execute_action(action: str, params: dict, user_id: str, plan_date: str, profile: dict, tz_name: str, session_id: str = "") -> str | None:
    """
    Execute the action Jarvis decided on.
    Returns an extra message to append if the action produces useful info, else None.
    """

    if action == "add_task":
        try:
            supabase.table("tasks").insert({
                "user_id": user_id,
                "title": params.get("title"),
                "priority": params.get("priority", "medium"),
                "estimated_minutes": params.get("estimated_minutes", 30),
                "description": params.get("description"),
                "status": "pending",
                "original_date": plan_date,
            }).execute()
            return None
        except Exception as e:
            if "max_tasks_per_priority" in str(e) or "3" in str(e):
                priority = params.get("priority", "medium")
                return f"You already have 3 {priority} priority tasks today — that's the maximum. Try a different priority or remove one first."
            raise

    elif action == "add_tasks":
            tasks_to_add = params.get("tasks", [])
            results = []
            for t in tasks_to_add:
                try:
                    supabase.table("tasks").insert({
                        "user_id": user_id,
                        "title": t.get("title"),
                        "priority": t.get("priority", "medium"),
                        "estimated_minutes": t.get("estimated_minutes", 30),
                        "description": t.get("description"),
                        "status": "pending",
                        "original_date": plan_date,
                    }).execute()
                except Exception as e:
                    if "max_tasks_per_priority" in str(e) or "3" in str(e):
                        results.append(f"'{t.get('title')}' skipped — already 3 {t.get('priority')} priority tasks today.")
                    else:
                        raise
            return "\n".join(results) if results else None
    
    elif action == "delete_task":
        task_id = params.get("task_id")
        if task_id:
            # 1. Fetch details first
            try:
                task_result = supabase.table("tasks") \
                    .select("title, priority") \
                    .eq("id", task_id) \
                    .eq("user_id", user_id) \
                    .maybe_single() \
                    .execute()
                task_data = task_result.data
            except Exception:
                task_data = None

            # 2. Log before deleting — if delete fails, log still exists as a trace
            if task_data:
                await log_deleted(
                    supabase=supabase,
                    user_id=user_id,
                    task_id=task_id,
                    task_title=task_data["title"],
                    priority=task_data["priority"],
                )

            # 3. Delete — if this raises, it bubbles up and user sees the error
            supabase.table("tasks").delete() \
                .eq("id", task_id) \
                .eq("user_id", user_id) \
                .execute()

        return None
    
    elif action == "log_unstructured":
            content = params.get("content")
            log_type = params.get("log_type")
            if content and log_type:
                supabase.table("unstructured_logs").insert({
                    "user_id": user_id,
                    "date": plan_date,
                    "content": content,
                    "log_type": log_type,
                }).execute()
            return None


    elif action == "save_eod_summary":
        summary = params.get("summary")
        if summary:
            supabase.table("eod_summaries").upsert({
                "user_id": user_id,
                "date": plan_date,
                "summary": summary,
            }).execute()

            try:
                supabase.table("checkin_sessions").update({
                    "eod_completed": True,
                }).eq("id", session_id).execute()
            except Exception as e:
                print(f"Failed to close session: {e}")

            try:
                from app.rag.alignment import save_goal_alignment_scores
                await save_goal_alignment_scores(user_id)
            except Exception as e:
                print(f"Failed to save alignment scores: {e}")

            try:
                from app.rag.personality import save_personality_insights
                save_personality_insights(user_id, tz_name)
            except Exception as e:
                print(f"Failed to save personality: {e}")

        return None
    


    elif action == "move_tasks_to_today":
        task_ids = params.get("task_ids", [])
        if task_ids:
            # 1. Fetch task details before updating (for logging)
            tasks_result = supabase.table("tasks") \
                .select("id, title, priority, original_date") \
                .in_("id", task_ids) \
                .eq("user_id", user_id) \
                .execute()

            # 2. Update dates
            supabase.table("tasks").update({
                "original_date": plan_date,
                "status": "pending",
            }).in_("id", task_ids) \
            .eq("user_id", user_id) \
            .execute()

            # 3. Log a reschedule event per task
            for t in tasks_result.data:
                await log_rescheduled(
                    supabase=supabase,
                    user_id=user_id,
                    task_id=t["id"],
                    task_title=t["title"],
                    priority=t["priority"],
                    prev_date=t["original_date"],
                    new_date=plan_date,
                    prev_scheduled_start=None,
                    new_scheduled_start=None,
                )
        return None
    



    elif action == "add_to_schedule":
        title = params.get("title")

        # 1. Check if schedule exists for today — required before adding
        plan = supabase.table("daily_plans") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("plan_date", plan_date) \
            .execute()

        if not plan.data:
            return "Generate your schedule first before adding individual tasks."

        plan_id = plan.data[0]["id"]

        # 2. Check if task already exists in today's tasks
        existing_task = supabase.table("tasks") \
            .select("id, estimated_minutes") \
            .eq("user_id", user_id) \
            .eq("original_date", plan_date) \
            .ilike("title", title) \
            .execute()

        if existing_task.data:
            task_id = existing_task.data[0]["id"]
            estimated = existing_task.data[0]["estimated_minutes"]
        else:
            task_result = supabase.table("tasks").insert({
                "user_id": user_id,
                "title": title,
                "priority": params.get("priority", "medium"),
                "estimated_minutes": params.get("estimated_minutes", 30),
                "description": params.get("description"),
                "status": "scheduled",
                "original_date": plan_date,
            }).execute()
            task_id = task_result.data[0]["id"]
            estimated = params.get("estimated_minutes", 30)

        # 3. Determine position
        existing_items = supabase.table("schedule_items") \
            .select("position") \
            .eq("plan_id", plan_id) \
            .order("position", desc=True) \
            .execute()

        next_position = (existing_items.data[0]["position"] + 1) if existing_items.data else 1

        # 4. Determine time
        start_time = params.get("start_time")
        end_time = params.get("end_time")

        if not start_time:
            now = datetime.now(zoneinfo.ZoneInfo(tz_name))
            start_time = now.strftime("%H:%M")

        if not end_time:
            start_dt = datetime.strptime(f"{plan_date}T{start_time}", "%Y-%m-%dT%H:%M")
            end_dt = start_dt + timedelta(minutes=estimated)
            end_time = end_dt.strftime("%H:%M")

        # 5. Insert schedule item
        supabase.table("schedule_items").insert({
            "plan_id": plan_id,
            "task_id": task_id,
            "user_id": user_id,
            "scheduled_start": f"{plan_date}T{start_time}:00",
            "scheduled_end": f"{plan_date}T{end_time}:00",
            "ai_reasoning": "Added via Jarvis chat",
            "position": next_position,
        }).execute()

        # 6. Update task status to scheduled
        supabase.table("tasks").update({"status": "scheduled"}) \
            .eq("id", task_id) \
            .eq("user_id", user_id) \
            .execute()

        return "Added to your schedule! Refresh the calendar to see it."
       

    elif action == "generate_schedule":
        # One schedule per day
        existing = supabase.table("daily_plans") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("plan_date", plan_date) \
            .execute()

        if existing.data:
            return "You've already generated today's schedule. Use 'add to schedule' to add individual tasks."

        request = build_schedule_request(user_id, plan_date)
        if not request.tasks:
            return "No pending tasks found for today — add some tasks first."

        schedule = await run_schedule_chain(request)
        await save_schedule(schedule, request, user_id)

        message = "Schedule generated! Refresh the calendar to see it."
        if request.neglected_goals:
            from app.rag.alignment import get_neglected_goals
            neglected = get_neglected_goals(user_id=user_id)
            if neglected:
                goal_titles = ", ".join(f"'{g['title']}'" for g in neglected)
                message += f"\n\nAlso — you haven't planned anything for {goal_titles} today and you committed to working on it. Want me to add a task for it?"
        return message
    


    elif action == "mark_complete":
        task_id = params.get("task_id")
        if task_id:
            # 1. Fetch task details before updating
            task_result = supabase.table("tasks") \
                .select("title, priority, original_date") \
                .eq("id", task_id) \
                .eq("user_id", user_id) \
                .maybe_single() \
                .execute()

            # 2. Fetch scheduled time from schedule_items
            item_result = supabase.table("schedule_items") \
                .select("scheduled_start") \
                .eq("task_id", task_id) \
                .order("scheduled_start", desc=True) \
                .limit(1) \
                .execute()

            # 3. Update status
            supabase.table("tasks").update({"status": "completed"}) \
                .eq("id", task_id) \
                .eq("user_id", user_id) \
                .execute()

            # 4. Log event
            if task_result.data:
                t = task_result.data
                scheduled_start = None
                if item_result.data:
                    scheduled_start = item_result.data[0]["scheduled_start"][11:16]

                await log_completed(
                    supabase=supabase,
                    user_id=user_id,
                    task_id=task_id,
                    task_title=t["title"],
                    priority=t["priority"],
                    scheduled_date=t["original_date"],
                    scheduled_start=scheduled_start,
                )
        return None

    
    elif action == "skip":
        task_id = params.get("task_id")
        if task_id:
            # 1. Fetch task details
            try:
                task_result = supabase.table("tasks") \
                    .select("title, priority, original_date") \
                    .eq("id", task_id) \
                    .eq("user_id", user_id) \
                    .maybe_single() \
                    .execute()
                task_data = task_result.data
            except Exception:
                task_data = None

            # 2. Fetch scheduled time before removing
            item_result = supabase.table("schedule_items") \
                .select("id, scheduled_start") \
                .eq("task_id", task_id) \
                .order("scheduled_start", desc=True) \
                .limit(1) \
                .execute()

            # 3. Update task status
            supabase.table("tasks").update({"status": "skipped"}) \
                .eq("id", task_id) \
                .eq("user_id", user_id) \
                .execute()

            # 4. Remove from schedule so it disappears from calendar
            if item_result.data:
                supabase.table("schedule_items").delete() \
                    .eq("id", item_result.data[0]["id"]) \
                    .execute()

            # 5. Log event
            if task_data:
                scheduled_start = None
                if item_result.data:
                    scheduled_start = item_result.data[0]["scheduled_start"][11:16]

                await log_skipped(
                    supabase=supabase,
                    user_id=user_id,
                    task_id=task_id,
                    task_title=task_data["title"],
                    priority=task_data["priority"],
                    scheduled_date=task_data["original_date"],
                    scheduled_start=scheduled_start,
                )
        return None

    
    elif action == "reschedule":
        schedule_item_id = params.get("schedule_item_id")
        new_start = params.get("new_start")
        new_end = params.get("new_end")
        if schedule_item_id and new_start and new_end:
            # 1. Fetch current state before updating
            current = supabase.table("schedule_items") \
                .select("scheduled_start, scheduled_end, task_id, tasks(title, priority, original_date)") \
                .eq("id", schedule_item_id) \
                .eq("user_id", user_id) \
                .maybe_single() \
                .execute()

            # 2. Update schedule item
            supabase.table("schedule_items").update({
                "scheduled_start": f"{plan_date}T{new_start}:00",
                "scheduled_end": f"{plan_date}T{new_end}:00",
            }).eq("id", schedule_item_id) \
            .eq("user_id", user_id) \
            .execute()

            # 3. Log reschedule event
            if current.data:
                c = current.data
                task = c["tasks"]
                prev_start = c["scheduled_start"][11:16]
                prev_date = c["scheduled_start"][:10]

                await log_rescheduled(
                    supabase=supabase,
                    user_id=user_id,
                    task_id=c["task_id"],
                    task_title=task["title"],
                    priority=task["priority"],
                    prev_date=prev_date,
                    new_date=plan_date,
                    prev_scheduled_start=prev_start,
                    new_scheduled_start=new_start,
                )
        return None
    


    elif action == "add_goal":
        title = params.get("title")
        description = params.get("description")
        deadline = params.get("deadline")
        committed_days = params.get("committed_days", [])
        committed_hours = params.get("committed_hours", 0)

        result = supabase.table("goals").insert({
            "user_id": user_id,
            "title": title,
            "description": description,
            "deadline": deadline,
            "committed_days": committed_days,
            "committed_hours": committed_hours,
        }).execute()

        goal_id = result.data[0]["id"]

        from app.rag.embedder import embed_goal
        embed_goal(user_id=user_id, goal_id=goal_id, title=title, description=description)

        return None


    elif action == "delete_goal":
        goal_id = params.get("goal_id")
        if goal_id:
            supabase.table("goals").delete() \
                .eq("id", goal_id) \
                .eq("user_id", user_id) \
                .execute()

            # Remove vector from ChromaDB
            from app.rag.embedder import delete_goal_embedding
            delete_goal_embedding(user_id=user_id, goal_id=goal_id)

        return None

    elif action == "extend_deadline":
        goal_id = params.get("goal_id")
        new_deadline = params.get("new_deadline")  # "YYYY-MM-DD"
        if goal_id and new_deadline:
            supabase.table("goals").update({"deadline": new_deadline}) \
                .eq("id", goal_id) \
                .eq("user_id", user_id) \
                .execute()
        return None



@router.websocket("/ws/checkin")
async def checkin_websocket(
    websocket: WebSocket,
    token: str = Query(...),
    plan_date: str = Query(...),
):
    # 1. Authenticate
    try:
        user_response = supabase.auth.get_user(token)
        user = user_response.user
        if not user:
            await websocket.close(code=4001, reason="Unauthorized")
            return
    except AuthApiError:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()
    user_id = user.id

    # 2. Load profile, build context, get/create session
    profile = get_user_profile(user_id)
    tz_name = profile["timezone"]
    schedule_context = get_schedule_context(user_id, plan_date, tz_name)
    profile_with_personality = supabase.table("profiles") \
        .select("personality_context") \
        .eq("id", user_id) \
        .single() \
        .execute()
    personality_context = (profile_with_personality.data or {}).get("personality_context") or ""
    session_id = get_or_create_session(user_id, plan_date)

    try:
        await websocket.send_json({"type": "connected", "session_id": session_id})

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "user_message":
                user_content = data.get("content", "")

                try:
                    # Check session EOD state fresh each message
                    session_result = supabase.table("checkin_sessions") \
                        .select("eod_started, eod_completed") \
                        .eq("id", session_id) \
                        .single() \
                        .execute()
                    eod_started = session_result.data.get("eod_started", False)
                    eod_completed = session_result.data.get("eod_completed", False)

                    # Detect EOD trigger from normal mode
                    eod_triggers = {"eod", "end of day", "wrap up", "summary of day", "daily summary", "day summary"}
                    is_eod_trigger = any(t in user_content.lower() for t in eod_triggers)

                    if not eod_started and is_eod_trigger:
                        if eod_completed:
                            await websocket.send_json({
                                "type": "stream_chunk",
                                "content": "EOD is already wrapped up for today. Feel free to keep chatting though!"
                            })
                            await websocket.send_json({"type": "stream_end", "actions": []})
                            continue

                        supabase.table("checkin_sessions").update({
                            "eod_started": True,
                        }).eq("id", session_id).execute()
                        eod_started = True

                    if eod_started and not eod_completed:
                        # Route to EOD chain
                        result = await run_eod_chain(
                            session_id=session_id,
                            user_id=user_id,
                            user_message=user_content,
                            plan_date=plan_date,
                            work_start=profile["work_start"],
                            work_end=profile["work_end"],
                            tz_name=tz_name,
                        )

                        actions = result.get("actions", [])
                        for a in actions:
                            action = a.get("action")
                            params = a.get("params", {})
                            if action in ("log_unstructured", "save_eod_summary"):
                                await execute_action(
                                    action=action,
                                    params=params,
                                    user_id=user_id,
                                    plan_date=plan_date,
                                    profile=profile,
                                    tz_name=tz_name,
                                    session_id=session_id,
                                )

                        await websocket.send_json({
                            "type": "stream_chunk",
                            "content": result["message"]
                        })
                        await websocket.send_json({
                            "type": "stream_end",
                            "actions": [a.get("action") for a in actions],
                            "eod_mode": True,
                        })
                        continue

                    # Normal Jarvis — runs when eod not started OR eod already completed
                    result = await run_checkin_chain(
                        session_id=session_id,
                        user_id=user_id,
                        user_message=user_content,
                        schedule_context=schedule_context,
                        personality_context=personality_context,
                        tz_name=tz_name,
                        plan_date=plan_date,
                        work_end=profile["work_end"],
                    )

                    actions = result.get("actions", [])
                    extra_messages = []

                    for a in actions:
                        action = a.get("action")
                        params = a.get("params", {})

                        if "_result" in a:
                            continue

                        if action and action != "general_reply":
                            extra = await execute_action(
                                action=action,
                                params=params,
                                user_id=user_id,
                                plan_date=plan_date,
                                profile=profile,
                                tz_name=tz_name,
                                session_id=session_id,
                            )
                            if extra:
                                extra_messages.append(extra)

                    if any(a.get("action") not in (
                        "general_reply", "get_tasks", "get_all_tasks", "get_free_slots",
                        "get_tasks_by_date", "get_history_by_date", "get_all_goals", "get_goal_progress",
                        "log_unstructured"
                    ) for a in actions):
                        schedule_context = get_schedule_context(user_id, plan_date, tz_name)

                    final_message = result["message"]
                    if extra_messages:
                        final_message += "\n" + "\n".join(extra_messages)

                    await websocket.send_json({
                        "type": "stream_chunk",
                        "content": final_message
                    })
                    await websocket.send_json({
                        "type": "stream_end",
                        "actions": [a.get("action") for a in actions],
                        "eod_mode": False,
                    })

                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e)
                    })

    except WebSocketDisconnect:
        print(f"Client disconnected: {user_id}")



