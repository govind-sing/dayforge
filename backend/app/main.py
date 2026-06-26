from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.routers import tasks, blocked_slots  # priority_blocks removed
from app.routers import profile

app = FastAPI(title="DayForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://day-forge-ten.vercel.app","http://localhost:3000"],
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

app.include_router(tasks.router)
app.include_router(blocked_slots.router)
app.include_router(profile.router)

@app.get("/")
def root():
    return {"status": "DayForge API running"}




