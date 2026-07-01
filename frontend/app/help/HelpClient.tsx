"use client";

import { useState } from "react";

const capabilities = [
  // ... (same data as before)
  { cat: "tasks", title: "Add a task", desc: "Add a single task to today's list with priority and time estimate.", examples: ["Add a high priority task to review my resume", "New task — deep work session, 2 hours, high"] },
  { cat: "tasks", title: "Add multiple tasks at once", desc: "Dump your whole to-do list in one message and Jarvis sorts it out.", examples: ["Add gym, read for 30 mins, and call mom"] },
  { cat: "tasks", title: "Mark a task complete", desc: "Tell Jarvis when you're done — it logs it and updates your schedule.", examples: ["Mark LeetCode as done", "I finished the gym session"] },
  { cat: "tasks", title: "Delete a task", desc: "Permanently remove a task. Jarvis confirms before deleting.", examples: ["Delete the email professor task"] },
  { cat: "tasks", title: "Skip a task", desc: "Drop a task from today without deleting it.", examples: ["Skip the reading task", "I'm not doing gym today"] },
  { cat: "tasks", title: "View today's tasks", desc: "See all tasks with their status — pending, scheduled, completed, skipped.", examples: ["What are my tasks today?", "What's pending?"] },
  { cat: "tasks", title: "Move tasks to today", desc: "Pull tasks from another day and reset them as pending.", examples: ["Move yesterday's unfinished tasks to today"] },
  
  { cat: "schedule", title: "Generate a schedule", desc: "Jarvis builds a time-blocked day plan from your tasks and energy patterns.", examples: ["Generate my schedule", "Plan my day"] },
  { cat: "schedule", title: "Add task to schedule at a time", desc: "Place a task directly on your calendar at a specific slot.", examples: ["Schedule LeetCode at 11am", "Add gym at 7am for 1 hour"] },
  { cat: "schedule", title: "Reschedule a task", desc: "Move a scheduled task to a different time slot.", examples: ["Move the standup to 3pm", "Push LeetCode to after lunch"] },
  { cat: "schedule", title: "Find free slots", desc: "See what time you have left today after your scheduled blocks.", examples: ["What's free today?", "Do I have any gaps this afternoon?"] },

  { cat: "goals", title: "Add a goal", desc: "Tell Jarvis what you're working toward, with an optional deadline.", examples: ["Add a goal: land an AI role by August", "New goal — build a gym habit"] },
  { cat: "goals", title: "View your goals", desc: "See all active goals with deadlines.", examples: ["What are my goals?", "List everything I'm working toward"] },
  { cat: "goals", title: "Delete a goal", desc: "Remove a goal permanently. Jarvis confirms first.", examples: ["Delete my gym goal"] },
  { cat: "goals", title: "Extend a goal deadline", desc: "Push back a deadline — Jarvis asks why. Weak reasons are flagged on your alignment score.", examples: ["Extend my job goal deadline to September"] },
  { cat: "goals", title: "Check goal progress", desc: "See completed and skipped tasks toward a goal over the past N days.", examples: ["How much have I done toward my job goal this week?", "Show my gym progress for 14 days"] },

  { cat: "review", title: "End of Day Review (EOD)", desc: "Essential daily reflection. Jarvis reviews your day, tracks goal alignment, personality insights, and suggests improvements.", examples: ["Do end of day review", "Run EOD", "What did I learn today?"] },

  { cat: "history", title: "Review a past day", desc: "See everything that happened on any date — tasks, blocked slots, completion status.", examples: ["What did I do last Tuesday?", "Show me June 10th"] },
  { cat: "meta", title: "Ask anything", desc: "Motivation, prioritisation, strategy, or thinking out loud — Jarvis is always ready.", examples: ["I'm feeling stuck today", "What should I focus on right now?"] },
];

const categories = ["all", "tasks", "schedule", "goals", "review", "history", "meta"];

const badgeColors: Record<string, string> = {
  tasks: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  schedule: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  goals: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  review: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-medium",
  history: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  meta: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
};

export default function HelpClient() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = capabilities.filter((c) => {
    const matchCat = filter === "all" || c.cat === filter;
    const q = search.toLowerCase();
    const matchQ = !q || c.title.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  return (
    <div className="font-dm max-w-5xl mx-auto">
      <input
        type="text"
        placeholder="Search capabilities..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-6 px-5 py-3.5 text-[15px] bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl focus:border-stone-400 outline-none"
      />

      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`text-xs px-4 py-2 rounded-full border transition-all font-medium tracking-wide ${
              filter === cat
                ? "bg-[#0f0e0c] dark:bg-[#f0ede8] text-[#f5f4f0] dark:text-[#0c0c0b] border-[#0f0e0c] dark:border-[#f0ede8]"
                : "border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 hover:border-stone-400"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-12">
          No results. Try a different search or category.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((c, i) => (
          <div
            key={i}
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 cursor-pointer hover:border-stone-400 dark:hover:border-stone-600 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-[15px] font-medium text-[#0f0e0c] dark:text-[#f0ede8] leading-tight">
                {c.title}
              </p>
              <span className={`text-xs px-3 py-1 rounded-full shrink-0 font-medium ${badgeColors[c.cat]}`}>
                {c.cat}
              </span>
            </div>

            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              {c.desc}
            </p>

            {expanded === i && (
              <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
                <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2.5">
                  Try saying
                </p>
                <div className="flex flex-wrap gap-2">
                  {c.examples.map((ex, j) => (
                    <span
                      key={j}
                      className="inline-block text-xs px-3 py-1.5 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-600 dark:text-stone-400"
                    >
                      “{ex}”
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}