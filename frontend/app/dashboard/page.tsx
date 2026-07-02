"use client";

import { useState, useEffect, useCallback } from "react";
import { TaskFormData } from "@/components/TaskRow";
import { BlockedSlotFormData } from "@/components/BlockedSlotsForm";
import { ScheduleResponse } from "@/types/schedule";

import Sidebar from "@/components/Sidebar";
import CalendarView from "@/components/CalendarView";
import ChatPanel from "@/components/ChatPanel";

import {
  apiGet,
  apiPost,
  apiDelete,
  apiPatch,
  generateSchedule,
  getSchedule,
} from "@/lib/api";

interface DailyPlanResponse {
  plan_date: string;
  tasks: TaskFormData[];
}

interface ProfileResponse {
  work_start: string;
  work_end: string;
  timezone: string;
}

interface TaskInput {
  id: string;
  title: string;
  description: string | null;
  estimated_minutes: number;
  priority: "high" | "medium" | "low";
}

interface GenerateSchedulePayload {
  plan_date: string;
  work_start: string;
  work_end: string;
  timezone: string;
  tasks: TaskInput[];
  blocked_slots: Array<{
    label: string;
    start_time: string;
    end_time: string;
  }>;
}

export default function DashboardPage() {
  // Data States
  const [highTasks, setHighTasks] = useState<TaskFormData[]>([]);
  const [mediumTasks, setMediumTasks] = useState<TaskFormData[]>([]);
  const [lowTasks, setLowTasks] = useState<TaskFormData[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlotFormData[]>([]);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Layout States
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [chatWidth, setChatWidth] = useState(320);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // closed by default on mobile
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Load Data
  const loadData = useCallback(async (selectedDate: string): Promise<void> => {
    try {
      const result = await apiGet<DailyPlanResponse>(
        `/api/tasks/daily-plan?plan_date=${selectedDate}`
      );
      
      const tasks = result.tasks ?? [];
      setHighTasks(tasks.filter((t) => t.priority === "high"));
      setMediumTasks(tasks.filter((t) => t.priority === "medium"));
      setLowTasks(tasks.filter((t) => t.priority === "low"));

      const slots = await apiGet<BlockedSlotFormData[]>(`/api/blocked-slots?date=${selectedDate}`);
      setBlockedSlots(slots ?? []);

      const existing = await getSchedule(selectedDate);
      setSchedule(existing);

      const completedFromTasks = tasks
        .filter((t): t is TaskFormData & { status: string; id: string } => 
          t.status === "completed" && !!t.id
        )
        .map((t) => t.id);

      const completedFromSchedule = existing
        ? existing.scheduled.filter((item) => item.is_done).map((item) => item.task_id)
        : [];

      setCompletedTaskIds(new Set([...completedFromTasks, ...completedFromSchedule]));
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  }, []);

  // Use effect to load data when date changes
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const result = await apiGet<DailyPlanResponse>(
          `/api/tasks/daily-plan?plan_date=${date}`
        );
        
        if (!isMounted) return;
        
        const tasks = result.tasks ?? [];
        setHighTasks(tasks.filter((t) => t.priority === "high"));
        setMediumTasks(tasks.filter((t) => t.priority === "medium"));
        setLowTasks(tasks.filter((t) => t.priority === "low"));

        const slots = await apiGet<BlockedSlotFormData[]>(`/api/blocked-slots?date=${date}`);
        if (!isMounted) return;
        setBlockedSlots(slots ?? []);

        const existing = await getSchedule(date);
        if (!isMounted) return;
        setSchedule(existing);

        const completedFromTasks = tasks
          .filter((t): t is TaskFormData & { status: string; id: string } => 
            t.status === "completed" && !!t.id
          )
          .map((t) => t.id);

        const completedFromSchedule = existing
          ? existing.scheduled.filter((item) => item.is_done).map((item) => item.task_id)
          : [];

        setCompletedTaskIds(new Set([...completedFromTasks, ...completedFromSchedule]));
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load data:", err);
        }
      }
    };

    void fetchData();

    return () => { isMounted = false; };
  }, [date]);

  const handleDateChange = (newDate: string): void => {
    setSchedule(null);
    setDate(newDate);
  };

  const handleDataChange = useCallback((): Promise<void> => loadData(date), [date, loadData]);

  // Resize Handler (Desktop only)
  const startResize = (e: React.MouseEvent<HTMLDivElement>, panel: 'sidebar' | 'chat'): void => {
    e.preventDefault();
    const startX = e.pageX;
    const startSidebar = sidebarWidth;
    const startChat = chatWidth;

    const onMouseMove = (moveEvent: MouseEvent): void => {
      const diff = moveEvent.pageX - startX;
      if (panel === 'sidebar') {
        setSidebarWidth(Math.max(240, Math.min(420, startSidebar + diff)));
      } else {
        setChatWidth(Math.max(280, Math.min(500, startChat - diff)));
      }
    };

    const onMouseUp = (): void => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleAddTask = async (task: Omit<TaskFormData, "id" | "status">): Promise<void> => {
  await apiPost<TaskFormData>("/api/tasks/daily-plan", {
    plan_date: date,
    title: task.title,
    description: task.description ?? '',
    estimated_minutes: task.estimated_minutes,
    priority: task.priority,
  });
  await loadData(date);
};

  const handleEditTask = async (taskId: string, updates: Partial<TaskFormData>): Promise<void> => {
    await apiPatch(`/api/tasks/${taskId}`, updates);
    const updateList = (tasks: TaskFormData[]): TaskFormData[] =>
      tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
    setHighTasks(updateList);
    setMediumTasks(updateList);
    setLowTasks(updateList);
  };

  const handleDeleteTask = async (taskId: string): Promise<void> => {
    await apiDelete(`/api/tasks/${taskId}`);
    const filterList = (tasks: TaskFormData[]): TaskFormData[] =>
      tasks.filter((t) => t.id !== taskId);
    setHighTasks(filterList);
    setMediumTasks(filterList);
    setLowTasks(filterList);
  };

  const handleGenerate = async (): Promise<void> => {
    const allTasks = [...highTasks, ...mediumTasks, ...lowTasks]
      .filter((t): t is TaskFormData & { id: string; status: string } =>
        t.title.trim() !== "" && !!t.id && t.status !== "completed"
      );

    if (allTasks.length === 0) return;

    setIsGenerating(true);
    try {
      const profile = await apiGet<ProfileResponse>("/api/profile");

      const freshSlots = await apiGet<BlockedSlotFormData[]>(
        `/api/blocked-slots?date=${date}`,
      );

      const now = new Date();
      const isToday = date === now.toISOString().split("T")[0];
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const effectiveStart = isToday
        ? currentTime > (profile.work_start || "06:00")
          ? currentTime
          : profile.work_start || "06:00"
        : profile.work_start || "06:00";

      const payload: GenerateSchedulePayload = {
        plan_date: date,
        work_start: effectiveStart,
        work_end: profile.work_end || "22:00",
        timezone:
          profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        tasks: allTasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description ?? null,
          estimated_minutes: t.estimated_minutes,
          priority: t.priority,
        })),
        blocked_slots: freshSlots.map((s) => ({
          label: s.label,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      };

      const result = await generateSchedule(payload);

      setSchedule(result);
      setBlockedSlots(freshSlots);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate schedule. Try again.";
      console.error("Generate failed:", err);
      setGenerateError(errorMessage);
      setTimeout(() => setGenerateError(null), 4000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleDone = async (taskId: string, isDone: boolean): Promise<void> => {
    try {
      await apiPatch(`/api/tasks/${taskId}`, {
        status: isDone ? "completed" : "scheduled",
      });

      setCompletedTaskIds((prev) => {
        const next = new Set(prev);
        if (isDone) {
          next.add(taskId);
        } else {
          next.delete(taskId);
        }
        return next;
      });

      const updateTasks = (tasks: TaskFormData[]): TaskFormData[] =>
        tasks.map((t) =>
          t.id === taskId
            ? { ...t, status: isDone ? "completed" : "scheduled" }
            : t,
        );

      setHighTasks(updateTasks);
      setMediumTasks(updateTasks);
      setLowTasks(updateTasks);

      setSchedule((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scheduled: prev.scheduled.map((item) =>
            item.task_id === taskId ? { ...item, is_done: isDone } : item,
          ),
        };
      });
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f5f4f0] dark:bg-[#0c0c0b] relative">
      
      {/* Sidebar */}
      <div 
        className={`bg-[#f5f4f0] dark:bg-[#0c0c0b] border-r border-stone-200 dark:border-stone-800 flex flex-col z-30 transition-transform duration-300 fixed md:relative h-full
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ width: `${sidebarWidth}px` }}
      >
        <Sidebar
          date={date}
          highTasks={highTasks}
          mediumTasks={mediumTasks}
          lowTasks={lowTasks}
          hasSchedule={schedule !== null}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          onToggleDone={handleToggleDone}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
        />

        <div
          onMouseDown={(e) => startResize(e, 'sidebar')}
          className="hidden md:block absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-stone-400 transition-colors z-20"
        />
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Mobile Top Bar */}
        <div className="md:hidden sticky top-0 z-40 bg-[#f5f4f0] dark:bg-[#0c0c0b] border-b border-stone-200 dark:border-stone-800 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-10 h-10 flex items-center justify-center text-2xl text-stone-600 dark:text-stone-400 active:scale-95 transition-transform"
          >
            {isSidebarOpen ? '✕' : '☰'}
          </button>
          
          <div className="font-medium text-lg tracking-tight">
            {new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
          </div>
          
          <div className="w-10" /> {/* Spacer */}
        </div>

        <CalendarView
          date={date}
          schedule={schedule}
          blockedSlots={blockedSlots}
          onDateChange={handleDateChange}
          onToggleDone={handleToggleDone}
          completedTaskIds={completedTaskIds}
          onBlockedSlotAdd={async (slot) => {
            const saved = await apiPost<BlockedSlotFormData>("/api/blocked-slots", slot);
            setBlockedSlots((prev) => [...prev, saved]);
          }}
          onBlockedSlotUpdate={(index, updated) => {
            setBlockedSlots((prev) => prev.map((s, i) => (i === index ? updated : s)));
          }}
          onScheduleItemUpdate={(taskId, newStart, newEnd) => {
            setSchedule((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                scheduled: prev.scheduled.map((item) =>
                  item.task_id === taskId ? { ...item, start_time: newStart, end_time: newEnd } : item
                ),
              };
            });
          }}
        />
      </div>

      {/* Chat Panel */}
      <div 
        className={`bg-[#f5f4f0] dark:bg-[#0c0c0b] border-l border-stone-200 dark:border-stone-800 flex flex-col z-30 transition-transform duration-300 fixed md:relative h-full right-0
          ${isChatOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}
        style={{ width: `${chatWidth}px` }}
      >
        <ChatPanel onDataChange={handleDataChange} />

        <div
          onMouseDown={(e) => startResize(e, 'chat')}
          className="hidden md:block absolute top-0 left-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-stone-400 transition-colors z-20"
        />
      </div>

      {/* Mobile Chat Button (Bottom Right) */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 md:hidden z-50 w-14 h-14 bg-[#0f0e0c] dark:bg-[#f0ede8] text-[#f5f4f0] dark:text-[#0c0c0b] rounded-2xl shadow-xl flex items-center justify-center text-2xl active:scale-95 transition-all"
      >
        💬
      </button>

      {/* Error Toast */}
      {generateError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl z-50 text-sm">
          ⚠️ {generateError}
        </div>
      )}
    </div>
  );
}