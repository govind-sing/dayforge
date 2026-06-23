from pydantic import BaseModel
from typing import Optional
from datetime import date

class TaskInput(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    estimated_minutes: int
    priority: str  # high / medium / low

class BlockedSlotInput(BaseModel):
    label: str
    start_time: str  # "HH:MM"
    end_time: str    # "HH:MM"

class ScheduleRequest(BaseModel):
    plan_date: date
    work_start: str
    work_end: str
    timezone: str
    tasks: list[TaskInput]
    blocked_slots: list[BlockedSlotInput]
    past_patterns: str = ""
    aligned_goals: str = ""  # goal alignment context from ChromaDB

class ScheduledItem(BaseModel):
    task_id: str
    title: str
    start_time: str
    end_time: str
    priority: str
    reasoning: str

class SkippedItem(BaseModel):
    task_id: str
    title: str
    priority: str
    reason: str

class ScheduleResponse(BaseModel):
    plan_date: str
    scheduled: list[ScheduledItem]
    skipped: list[SkippedItem]
    summary: str

class ScheduleItemUpdate(BaseModel):
    plan_date: str
    start_time: str
    end_time: str