import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser
from app.prompts.schedule_prompt import schedule_prompt
from app.core.config import settings
from app.models.schemas import ScheduleRequest, ScheduleResponse

llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.3,  # low temp = more consistent, structured output
)

# The chain: format prompt → send to Gemini → get string back
schedule_chain = schedule_prompt | llm | StrOutputParser()

def format_tasks(tasks) -> str:
    lines = []
    for t in tasks:
        desc = f" — {t.description}" if t.description else ""
        lines.append(
            f"- [{t.priority.upper()}] {t.title}{desc} ({t.estimated_minutes} mins) [id: {t.id}]"
        )
    return "\n".join(lines) if lines else "No tasks provided."

def format_blocked_slots(slots) -> str:
    if not slots:
        return "None"
    return "\n".join(
        f"- {s.label}: {s.start_time} to {s.end_time}"
        for s in slots
    )

async def run_schedule_chain(request: ScheduleRequest) -> ScheduleResponse:
    raw_output = await schedule_chain.ainvoke({
        "plan_date": str(request.plan_date),
        "work_start": request.work_start,
        "work_end": request.work_end,
        "timezone": request.timezone,
        "tasks": format_tasks(request.tasks),
        "blocked_slots": format_blocked_slots(request.blocked_slots),
    })

    # Strip markdown fences if Gemini adds them despite instructions
    cleaned = raw_output.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()

    parsed = json.loads(cleaned)
    return ScheduleResponse(**parsed)