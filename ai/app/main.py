from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.routers import schedule, checkin
from app.routers import debug as debug_router
from app.core.supabase_client import supabase
from app.rag.embedder import embed_task_outcome, embed_goal


def rebuild_chroma_from_supabase():
    print("[ChromaDB] Starting rebuild from task_events...")

    result = supabase.table("task_events") \
        .select("user_id, task_id, task_title, priority, scheduled_start, event_type, scheduled_date") \
        .in_("event_type", ["completed", "skipped"]) \
        .execute()

    if not result.data:
        print("[ChromaDB] No events found — skipping rebuild.")
        return

    count = 0
    for row in result.data:
        try:
            # Skip deleted tasks — no task_id, no useful schedule pattern
            if not row.get("task_id"):
                continue

            scheduled_start = row.get("scheduled_start")
            if scheduled_start:
                scheduled_start = str(scheduled_start)[:5]

            embed_task_outcome(
                user_id=row["user_id"],
                task_id=row["task_id"],
                task_title=row["task_title"],
                priority=row["priority"],
                scheduled_start=scheduled_start,
                event_type=row["event_type"],
                event_date=str(row["scheduled_date"]),
            )
            count += 1
        except Exception as e:
            print(f"[ChromaDB] Failed to embed row {row.get('task_id')}: {e}")
            continue
        
    print(f"[ChromaDB] Rebuild complete — {count} events embedded.")


def rebuild_goals_from_supabase():
    print("[ChromaDB] Rebuilding goals...")

    result = supabase.table("goals") \
        .select("user_id, id, title, description") \
        .execute()

    if not result.data:
        print("[ChromaDB] No goals found — skipping.")
        return

    count = 0
    for row in result.data:
        try:
            embed_goal(
                user_id=row["user_id"],
                goal_id=row["id"],
                title=row["title"],
                description=row.get("description"),
            )
            count += 1
        except Exception as e:
            print(f"[ChromaDB] Failed to embed goal {row.get('id')}: {e}")
            continue

    print(f"[ChromaDB] Goals rebuild complete — {count} goals embedded.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    rebuild_chroma_from_supabase()
    rebuild_goals_from_supabase()
    yield



app = FastAPI(title="DayForge AI Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "https://day-forge-ten.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("UNHANDLED ERROR:", repr(exc))
    response = JSONResponse(status_code=500, content={"detail": str(exc)})
    response.headers["Access-Control-Allow-Origin"] = "https://day-forge-ten.vercel.app"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

app.include_router(schedule.router, prefix="/api/ai")
app.include_router(checkin.router, prefix="/api/ai")
app.include_router(debug_router.router)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "dayforge-ai"}