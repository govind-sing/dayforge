from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.supabase_client import supabase
from app.chains.checkin_chain import run_checkin_chain
from app.chains.schedule_chain import run_schedule_chain, save_schedule
from gotrue.errors import AuthApiError
from datetime import datetime, timedelta
from app.routers.schedule import build_schedule_request

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


def convert_utc_to_local(utc_timestamp: str) -> str:
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

    return "\n".join(lines)


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


async def execute_action(action: str, params: dict, user_id: str, plan_date: str, profile: dict, tz_name: str) -> str | None:
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
            supabase.table("tasks").delete() \
                .eq("id", task_id) \
                .eq("user_id", user_id) \
                .execute()
        return None
    

    elif action == "move_tasks_to_today":
        task_ids = params.get("task_ids", [])
        if task_ids:
            supabase.table("tasks").update({
                "original_date": plan_date,
                "status": "pending",
            }).in_("id", task_ids) \
            .eq("user_id", user_id) \
            .execute()
        return None
    



    elif action == "add_to_schedule":
        title = params.get("title")

        # 1. Check if task already exists in today's tasks
        existing_task = supabase.table("tasks") \
            .select("id, estimated_minutes") \
            .eq("user_id", user_id) \
            .eq("original_date", plan_date) \
            .ilike("title", title) \
            .execute()

        if existing_task.data:
            # Reuse existing task
            task_id = existing_task.data[0]["id"]
            estimated = existing_task.data[0]["estimated_minutes"]
        else:
            # Create new task
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

        # 2. Get today's plan_id
        plan = supabase.table("daily_plans") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("plan_date", plan_date) \
            .execute()

        if not plan.data:
            plan = supabase.table("daily_plans").insert({
                "user_id": user_id,
                "plan_date": plan_date,
                "status": "draft",
                "raw_llm_output": "",
                "generation_meta": {}
            }).execute()

        plan_id = plan.data[0]["id"]

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
        request = build_schedule_request(user_id, plan_date)
        if not request.tasks:
            return "No pending tasks found for today — add some tasks first."
        schedule = await run_schedule_chain(request)
        await save_schedule(schedule, request, user_id)
        return "Schedule generated! Refresh the calendar to see it."
    
    elif action == "mark_complete":
        task_id = params.get("task_id")
        if task_id:
            supabase.table("tasks").update({"status": "completed"}) \
                .eq("id", task_id) \
                .eq("user_id", user_id) \
                .execute()
        return None

    elif action == "skip":
        task_id = params.get("task_id")
        if task_id:
            supabase.table("tasks").update({"status": "skipped"}) \
                .eq("id", task_id) \
                .eq("user_id", user_id) \
                .execute()
        return None

    elif action == "reschedule":
        schedule_item_id = params.get("schedule_item_id")
        new_start = params.get("new_start")
        new_end = params.get("new_end")
        if schedule_item_id and new_start and new_end:
            supabase.table("schedule_items").update({
                "scheduled_start": f"{plan_date}T{new_start}:00",
                "scheduled_end": f"{plan_date}T{new_end}:00",
            }).eq("id", schedule_item_id) \
              .eq("user_id", user_id) \
              .execute()
        return None

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
                    result = await run_checkin_chain(
                        session_id=session_id,
                        user_id=user_id,
                        user_message=user_content,
                        schedule_context=schedule_context,
                        tz_name=tz_name,
                        plan_date=plan_date,
                        work_end=profile["work_end"],
                    )

                    actions = result.get("actions", [])
                    extra_messages = []

                    for a in actions:
                        action = a.get("action")
                        params = a.get("params", {})

                        # Skip read-only actions — already handled in chain
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
                            )
                            if extra:
                                extra_messages.append(extra)

                    # Refresh context after any mutations
                    if any(a.get("action") not in ("general_reply", "get_tasks", "get_all_tasks", "get_free_slots", "get_tasks_by_date", "get_history_by_date") for a in actions):
                        schedule_context = get_schedule_context(user_id, plan_date, tz_name)

                    final_message = result["message"]
                    if extra_messages:
                        final_message += "\n" + "\n".join(extra_messages)

                    await websocket.send_json({
                        "type": "stream_chunk",
                        "content": final_message
                    })

                    # Collect all action types for frontend
                    action_types = [a.get("action") for a in actions]
                    await websocket.send_json({
                        "type": "stream_end",
                        "actions": action_types,
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