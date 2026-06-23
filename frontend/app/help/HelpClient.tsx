"use client"

import { useState } from "react"

const capabilities = [
  // Tasks
  { cat: "tasks", title: "Add a task", desc: "Add a single task to today's list with priority and time estimate.", examples: ["Add a high priority task to review my resume", "New task — deep work session, 2 hours, high"] },
  { cat: "tasks", title: "Add multiple tasks at once", desc: "Dump your whole to-do list in one message and Jarvis sorts it out.", examples: ["Add gym, read for 30 mins, and call mom"] },
  { cat: "tasks", title: "Mark a task complete", desc: "Tell Jarvis when you're done — it logs it and updates your schedule.", examples: ["Mark LeetCode as done", "I finished the gym session"] },
  { cat: "tasks", title: "Delete a task", desc: "Permanently remove a task. Jarvis confirms before deleting.", examples: ["Delete the email professor task"] },
  { cat: "tasks", title: "Skip a task", desc: "Drop a task from today without deleting it.", examples: ["Skip the reading task", "I'm not doing gym today"] },
  { cat: "tasks", title: "View today's tasks", desc: "See all tasks with their status — pending, scheduled, completed, skipped.", examples: ["What are my tasks today?", "What's pending?"] },
  { cat: "tasks", title: "Move tasks to today", desc: "Pull tasks from another day and reset them as pending.", examples: ["Move yesterday's unfinished tasks to today"] },
  // Schedule
  { cat: "schedule", title: "Generate a schedule", desc: "Jarvis builds a time-blocked day plan from your tasks and energy patterns.", examples: ["Generate my schedule", "Plan my day"] },
  { cat: "schedule", title: "Add task to schedule at a time", desc: "Place a task directly on your calendar at a specific slot.", examples: ["Schedule LeetCode at 11am", "Add gym at 7am for 1 hour"] },
  { cat: "schedule", title: "Reschedule a task", desc: "Move a scheduled task to a different time slot.", examples: ["Move the standup to 3pm", "Push LeetCode to after lunch"] },
  { cat: "schedule", title: "Find free slots", desc: "See what time you have left today after your scheduled blocks.", examples: ["What's free today?", "Do I have any gaps this afternoon?"] },
  { cat: "schedule", title: "Get tasks by date", desc: "Look up what was planned on any day — past or future.", examples: ["What did I have last Monday?", "Show me tomorrow's list"] },
  // Goals
  { cat: "goals", title: "Add a goal", desc: "Tell Jarvis what you're working toward, with an optional deadline.", examples: ["Add a goal: land an AI role by August", "New goal — build a gym habit"] },
  { cat: "goals", title: "View your goals", desc: "See all active goals with deadlines.", examples: ["What are my goals?", "List everything I'm working toward"] },
  { cat: "goals", title: "Delete a goal", desc: "Remove a goal permanently. Jarvis confirms first.", examples: ["Delete my gym goal"] },
  { cat: "goals", title: "Extend a goal deadline", desc: "Push back a deadline — Jarvis asks why. Weak reasons are flagged on your alignment score.", examples: ["Extend my job goal deadline to September"] },
  { cat: "goals", title: "Check goal progress", desc: "See completed and skipped tasks toward a goal over the past N days.", examples: ["How much have I done toward my job goal this week?", "Show my gym progress for 14 days"] },
  // History
  { cat: "history", title: "Review a past day", desc: "See everything that happened on any date — tasks, blocked slots, completion status.", examples: ["What did I do last Tuesday?", "Show me June 10th between 9am and 1pm"] },
  // General
  { cat: "meta", title: "Ask anything", desc: "Motivation, prioritisation, or just thinking out loud — Jarvis handles it.", examples: ["I'm feeling stuck today", "What should I focus on right now?"] },
]

const categories = ["all", "tasks", "schedule", "goals", "history", "meta"]

const badgeColors: Record<string, string> = {
  tasks: "bg-purple-50 text-purple-700",
  schedule: "bg-emerald-50 text-emerald-700",
  goals: "bg-amber-50 text-amber-700",
  history: "bg-blue-50 text-blue-700",
  meta: "bg-gray-100 text-gray-600",
}

export default function HelpClient() {
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<number | null>(null)

  const filtered = capabilities.filter(c => {
    const matchCat = filter === "all" || c.cat === filter
    const q = search.toLowerCase()
    const matchQ = !q || c.title.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
    return matchCat && matchQ
  })

  return (
    <div>
      <input
        type="text"
        placeholder="Search capabilities..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full mb-5 px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === cat
                ? "bg-gray-900 text-white border-gray-900"
                : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">
          No results. Try a different search or category.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((c, i) => (
          <div
            key={i}
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <p className="text-sm font-medium text-gray-900">{c.title}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badgeColors[c.cat]}`}>
                {c.cat}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>

            {expanded === i && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Try saying
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.examples.map((ex, j) => (
                    <span
                      key={j}
                      className="text-xs px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-600"
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}