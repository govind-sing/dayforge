from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.routers import schedule

app = FastAPI(title="DayForge AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000","https://day-forge-ten.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("UNHANDLED ERROR:", repr(exc))
    response = JSONResponse(status_code=500, content={"detail": str(exc)})
    response.headers["Access-Control-Allow-Origin"] = "https://day-forge-ten.vercel.app","http://localhost:3000"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

app.include_router(schedule.router, prefix="/api/ai")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "dayforge-ai"}