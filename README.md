# DayForge

**A Jarvis-style AI day planner and personal accountability mirror.**

Not a task manager. Something between a journal, a coach, and a trusted friend with perfect memory of how you spend your time. The core philosophy: time is like money — DayForge helps you see exactly where yours goes.

---

## What It Does

DayForge generates an energy-aware daily schedule from your tasks, blocked slots, and goals — then holds you accountable to it through a conversational AI (Jarvis) that remembers your patterns. At end of day, it walks through your actual day with you, learns from the gaps, and adjusts how it understands you over time.

**Key capabilities:**
- AI-generated daily schedule, priority- and energy-aware
- Jarvis chat agent with WebSocket-backed real-time interaction
- Full cross-day task access — reschedule, defer, or move tasks via natural language
- RAG on your task history — Jarvis knows what you skip, what you defer, what you actually finish
- Goal tracking with committed days/hours, alignment scoring, and neglect detection
- End-of-day review mode: walks through your day chronologically, logs partial completions and free time
- Personality context built from EOD data, injected into next-day Jarvis prompt
- Per-goal alignment scores with improving / consistent / drifting labels

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, FullCalendar |
| Backend | FastAPI (CRUD service) |
| AI Service | FastAPI, LangChain, Gemini 2.0 Flash, Gemini Embedding 001, ChromaDB |
| Database | Supabase (PostgreSQL + Auth) |
| Hosting | Vercel (frontend), AWS EC2 t2.micro (backend + AI service) |
| Infra | Docker Compose, nginx, Cloudflare Tunnel |
| CI/CD | GitHub Actions → SSH → `docker-compose up --build` |

---

## Architecture

```
dayforge/
├── frontend/               # Next.js → Vercel
├── backend/                # FastAPI CRUD → EC2
├── ai/                     # FastAPI + LangChain + Jarvis → EC2
│   └── app/
│       ├── chains/         # checkin_chain.py, schedule_chain.py, eod_chain.py
│       ├── core/           # config.py, supabase_client.py, chroma_client.py
│       ├── models/         # schemas.py
│       ├── prompts/        # schedule_prompt.py
│       ├── rag/            # embedder.py, retriever.py, personality.py, alignment.py
│       ├── routers/        # checkin.py, schedule.py, goals.py, alignment.py, debug.py
│       ├── task_event_logger/
│       └── main.py
└── docker-compose.prod.yml
```

Both the backend and AI service run on a single EC2 t2.micro behind nginx. Frontend auto-deploys to Vercel on push. HTTPS is handled by Cloudflare Tunnel — no custom domain required.

---

## Key Design Decisions

**ChromaDB EphemeralClient over a persisted volume** — Supabase is the single source of truth. ChromaDB is rebuilt from Supabase on every startup. No volume fragility, no sync bugs.

**Gemini Embedding 001 over sentence-transformers** — eliminates local model RAM overhead and cold start delays on t2.micro.

**EOD as a separate chain** — `eod_chain.py` is completely decoupled from the main Jarvis chain. EOD mode is time-gated (within one hour of `work_end`) and tracked via `eod_started` / `eod_completed` flags on the session.

**One schedule per day** — `generate_schedule` is blocked if a `daily_plan` already exists for that date. `add_to_schedule` requires an existing plan — schedule generation is always the entry point.

**Personality context computed once at EOD** — stored in `profiles.personality_context`, injected into Jarvis the next day. Not recomputed on every WebSocket connect.

**Jarvis is the sole interaction surface** — sidebar manual complete/delete deprecated. All task operations go through chat.

**Timestamps in local time (IST)** — no UTC conversion layer; string slicing `[11:16]` used directly.

**Goals require commitment** — `committed_days` and `committed_hours` are mandatory. A goal without a commitment is just a wish.

---

## Alignment Scoring

Each goal gets a daily score based on committed hours vs actual hours completed:

- Completed ≥ committed hours → up to 120% (bonus for overdelivery)
- Genuine skip reason (judged by Gemini) → 50%
- Excuse or no reason → 0%

Overall alignment = average of per-goal daily scores over the last 14 committed days. Label is computed from recent vs previous 7-day trend: **improving / consistent / drifting**.

Neglected goals (committed day with zero aligned activity) are injected into the schedule prompt so Jarvis nudges — never invents task IDs.

---

## RAG Pipeline

1. Every `complete` / `skip` event triggers `embed_task_outcome()` — one vector per task in ChromaDB (`task_outcomes` collection)
2. At schedule generation, today's task titles are used to query ChromaDB for semantically similar past outcomes
3. Retrieved `past_patterns` are injected into the schedule prompt as a context block
4. Goals are embedded separately in a `goals` collection; `get_aligned_goals()` is injected into both schedule and Jarvis context

All ChromaDB queries are scoped by `user_id` via a `where` filter.

---

## Jarvis Actions

Jarvis supports multi-action responses in a single message via an `actions` JSON array:

`add_task` · `add_tasks` · `add_to_schedule` · `generate_schedule` · `mark_complete` · `reschedule` · `skip` · `delete_task` · `get_tasks` · `get_all_tasks` · `get_free_slots` · `get_tasks_by_date` · `move_tasks_to_today` · `get_history_by_date` · `general_reply` · `log_unstructured` · `add_goal` · `delete_goal` · `extend_deadline` · `get_all_goals` · `get_goal_progress`

---

## Database Schema (Supabase)

| Table | Purpose |
|---|---|
| `profiles` | User settings, work hours, personality context |
| `tasks` | Tasks with priority enum (high/medium/low), max 3 per priority via PG trigger |
| `blocked_slots` | Recurring blocks filtered by `active_from` |
| `daily_plans` | One per day; gating record for schedule generation |
| `schedule_items` | Individual scheduled blocks with AI reasoning |
| `checkin_sessions` | One per day; tracks EOD state |
| `checkin_messages` | Full conversation history for DB-backed Jarvis memory |
| `task_events` | Immutable event log (complete / skip / reschedule / delete) |
| `goals` | Goals with commitment fields and per-goal alignment scores |
| `unstructured_logs` | EOD-reported partial hours, skip reasons, free time reflections |
| `eod_summaries` | End-of-day narrative summaries |

---

## Running Locally

```bash
# Clone
git clone https://github.com/govind-sing/dayforge
cd dayforge

# Environment variables
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY

# Start backend + AI service
docker-compose -f docker-compose.prod.yml up --build

# Frontend
cd frontend
npm install
npm run dev
```

Requires: Docker, Node.js 20+, a Supabase project, and a Gemini API key.

---

## Live Demo

Frontend: [dayforge.vercel.app](https://day-forge-ten.vercel.app/)  
GitHub: [github.com/govind-sing/dayforge](https://github.com/govind-sing/dayforge)
