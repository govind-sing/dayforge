import { supabase } from './supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'
const AI_BASE = process.env.EXPO_PUBLIC_AI_URL || 'http://localhost:8001'

async function authHeader(): Promise<{ Authorization: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${token}` }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: await authHeader(),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: await authHeader(),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function generateSchedule(payload: object): Promise<ScheduleResponse> {
  const res = await fetch(`${AI_BASE}/api/ai/generate-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getSchedule(date: string): Promise<ScheduleResponse | null> {
  const res = await fetch(`${AI_BASE}/api/ai/schedule/${date}`, {
    headers: await authHeader(),
  })
  if (!res.ok) return null
  return res.json()
}

export async function updateScheduleItem(
  taskId: string,
  planDate: string,
  startTime: string,
  endTime: string
): Promise<void> {
  const res = await fetch(`${AI_BASE}/api/ai/schedule-item/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ plan_date: planDate, start_time: startTime, end_time: endTime }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function updateBlockedSlot(
  slotId: string,
  startTime: string,
  endTime: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/blocked-slots/${slotId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ start_time: startTime, end_time: endTime }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function getProfile(): Promise<Profile> {
  return apiGet('/api/profile')
}

export async function updateProfile(body: { work_start?: string; work_end?: string }): Promise<void> {
  await apiPatch('/api/profile', body)
}

// Types
export interface ScheduledItem {
  task_id: string
  title: string
  start_time: string
  end_time: string
  priority: 'high' | 'medium' | 'low'
  reasoning: string
  is_done?: boolean
}

export interface SkippedItem {
  task_id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  reason: string
}

export interface ScheduleResponse {
  plan_date: string
  scheduled: ScheduledItem[]
  skipped: SkippedItem[]
  summary: string
}

export interface TaskFormData {
  id?: string
  title: string
  description: string
  estimated_minutes: number
  priority: 'high' | 'medium' | 'low'
  status?: string
}

export interface Profile {
  display_name: string
  email: string
  work_start: string
  work_end: string
  personality_context: string | null
  goals: Goal[]
}

export interface Goal {
  id: string
  title: string
  description: string | null
  deadline: string | null
  created_at: string
  alignment_score: number | null
  alignment_updated_at: string | null
  committed_days: string[]
  committed_hours: number
}