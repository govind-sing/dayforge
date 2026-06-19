export interface ScheduledItem {
  task_id: string
  title: string
  start_time: string
  end_time: string
  priority: "high" | "medium" | "low"
  reasoning: string
  is_done?: boolean
}

export interface SkippedItem {
  task_id: string
  title: string
  priority: "high" | "medium" | "low"
  reason: string
}

export interface ScheduleResponse {
  plan_date: string
  scheduled: ScheduledItem[]
  skipped: SkippedItem[]
  summary: string
}