from pydantic import BaseModel, Field, field_validator
from datetime import date, time
from typing import Optional, Literal
from uuid import UUID
from collections import Counter


# ── Task ──────────────────────────────────────────────────────

class TaskInput(BaseModel):
    title: str
    description: Optional[str] = None
    estimated_minutes: int = Field(gt=0, le=480)
    priority: Literal["high", "medium", "low"]


class TaskOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    estimated_minutes: int
    priority: Literal["high", "medium", "low"]
    status: str
    original_date: date


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_minutes: Optional[int] = Field(default=None, gt=0, le=480)
    priority: Optional[Literal["high", "medium", "low"]] = None
    status: Optional[Literal["pending","scheduled","in_progress",
                              "completed","skipped","rescheduled"]] = None


# ── Daily Plan (the form submission) ────────────────────────────

class DailyPlanInput(BaseModel):
    plan_date: date
    tasks: list[TaskInput] = Field(max_length=9)  # 3 priorities × max 3 each

    @field_validator("tasks")
    @classmethod
    def validate_priority_limits(cls, tasks: list[TaskInput]) -> list[TaskInput]:
        counts = Counter(t.priority for t in tasks)
        for level, count in counts.items():
            if count > 3:
                raise ValueError(f"Max 3 tasks allowed for '{level}' priority, got {count}")
        return tasks


# ── Blocked Slots (unchanged) ────────────────────────────────────

class BlockedSlotInput(BaseModel):
    label: str
    start_time: time
    end_time: time
    recurrence: Literal["none","daily","weekdays","weekly"] = "none"
    day_of_week: Optional[int] = Field(default=None, ge=0, le=6)
    active_from: Optional[date] = None
    active_until: Optional[date] = None


class BlockedSlotOut(BlockedSlotInput):
    id: UUID