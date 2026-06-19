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

export default function DashboardPage() {
  const [highTasks, setHighTasks] = useState<TaskFormData[]>([]);
  const [mediumTasks, setMediumTasks] = useState<TaskFormData[]>([]);
  const [lowTasks, setLowTasks] = useState<TaskFormData[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlotFormData[]>([]);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(
    new Set(),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  // Load plan + schedule for selected date
  const loadData = useCallback(async (selectedDate: string) => {
    try {
      // Load tasks
      const result = await apiGet<{ plan_date: string; tasks: TaskFormData[] }>(
        `/api/tasks/daily-plan?plan_date=${selectedDate}`,
      );

      const tasks = result.tasks ?? [];
      setHighTasks(tasks.filter((t) => t.priority === "high"));
      setMediumTasks(tasks.filter((t) => t.priority === "medium"));
      setLowTasks(tasks.filter((t) => t.priority === "low"));

      // Load blocked slots
      const slots = await apiGet<BlockedSlotFormData[]>(
        `/api/blocked-slots?date=${selectedDate}`,
      );
      setBlockedSlots(slots ?? []);

      // Load existing schedule
      const existing = await getSchedule(selectedDate);
      setSchedule(existing);

      // Build completed IDs from both tasks and schedule
      const completedFromTasks = tasks
        .filter((t) => (t as any).status === "completed")
        .map((t) => (t as any).id as string);

      const completedFromSchedule = existing
        ? existing.scheduled
            .filter((item) => item.is_done)
            .map((item) => item.task_id)
        : [];

      setCompletedTaskIds(
        new Set([...completedFromTasks, ...completedFromSchedule]),
      );
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  }, []);

  useEffect(() => {
    loadData(date);
  }, [date, loadData]);

  const handleDateChange = (newDate: string) => {
    setSchedule(null);
    setDate(newDate);
  };

  const handleAddTask = async (task: Omit<TaskFormData, "id" | "status">) => {
    const saved = await apiPost<TaskFormData>("/api/tasks/daily-plan", {
      plan_date: date,
      tasks: [...highTasks, ...mediumTasks, ...lowTasks, task].filter(
        (t) => t.title.trim() !== "",
      ),
    });
    // Reload tasks from DB to get the new ID
    await loadData(date);
  };

  const handleEditTask = async (
    taskId: string,
    updates: Partial<TaskFormData>,
  ) => {
    await apiPatch(`/api/tasks/${taskId}`, updates);
    const updateList = (tasks: TaskFormData[]) =>
      tasks.map((t) => ((t as any).id === taskId ? { ...t, ...updates } : t));
    setHighTasks(updateList);
    setMediumTasks(updateList);
    setLowTasks(updateList);
  };

  const handleDeleteTask = async (taskId: string) => {
    await apiDelete(`/api/tasks/${taskId}`);
    const filterList = (tasks: TaskFormData[]) =>
      tasks.filter((t) => (t as any).id !== taskId);
    setHighTasks(filterList);
    setMediumTasks(filterList);
    setLowTasks(filterList);
  };

  const handleToggleDone = async (taskId: string, isDone: boolean) => {
    try {
      await apiPatch(`/api/tasks/${taskId}`, {
        status: isDone ? "completed" : "scheduled",
      });

      setCompletedTaskIds((prev) => {
        const next = new Set(prev);
        isDone ? next.add(taskId) : next.delete(taskId);
        return next;
      });

      const updateTasks = (tasks: TaskFormData[]) =>
        tasks.map((t) =>
          (t as any).id === taskId
            ? { ...t, status: isDone ? "completed" : "scheduled" }
            : t,
        );

      setHighTasks(updateTasks);
      setMediumTasks(updateTasks);
      setLowTasks(updateTasks);

      // Update schedule item color instantly without reload
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

  const handleGenerate = async () => {
    const allTasks = [...highTasks, ...mediumTasks, ...lowTasks]
      .filter((t) => t.title.trim() !== "" && (t as any).id)
      .filter((t) => (t as any).status !== "completed"); // exclude done tasks

    if (allTasks.length === 0) return;

    setIsGenerating(true);
    try {
      const profile = await apiGet<{
        work_start: string;
        work_end: string;
        timezone: string;
      }>("/api/profile");

      // Refetch blocked slots fresh from DB
      const freshSlots = await apiGet<BlockedSlotFormData[]>(
        `/api/blocked-slots?date=${date}`,
      );

      // If generating mid-day, start from current time instead of work_start
      const now = new Date();
      const isToday = date === now.toISOString().split("T")[0];
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const effectiveStart = isToday
        ? currentTime > (profile.work_start || "06:00")
          ? currentTime
          : profile.work_start || "06:00"
        : profile.work_start || "06:00";

      const result = await generateSchedule({
        plan_date: date,
        work_start: effectiveStart,
        work_end: profile.work_end || "22:00",
        timezone:
          profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        tasks: allTasks.map((t) => ({
          id: (t as any).id,
          title: t.title,
          description: (t as any).description ?? null,
          estimated_minutes: t.estimated_minutes,
          priority: t.priority,
        })),
        blocked_slots: freshSlots.map((s) => ({
          label: s.label,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      });

      setSchedule(result);
      setBlockedSlots(freshSlots); // sync state with what was actually sent
    } catch (err: any) {
      console.error("Generate failed:", err);
      setGenerateError(
        err?.message || "Failed to generate schedule. Try again.",
      );
      setTimeout(() => setGenerateError(null), 4000);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 shrink-0 bg-white border-r flex flex-col h-full">
        <Sidebar
          date={date}
          highTasks={highTasks}
          mediumTasks={mediumTasks}
          lowTasks={lowTasks}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          onToggleDone={handleToggleDone}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
        />
        {generateError && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white text-sm px-4 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
            ⚠️ {generateError}
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="flex-1 bg-white border-r flex flex-col h-full min-w-0">
        <CalendarView
          date={date}
          schedule={schedule}
          blockedSlots={blockedSlots}
          onDateChange={handleDateChange}
          onToggleDone={handleToggleDone}
          completedTaskIds={completedTaskIds}
          onBlockedSlotAdd={async (slot) => {
            const saved = await apiPost<BlockedSlotFormData>(
              "/api/blocked-slots",
              slot,
            );
            setBlockedSlots((prev) => [...prev, saved]);
          }}
          onBlockedSlotUpdate={(index, updated) => {
            setBlockedSlots((prev) =>
              prev.map((s, i) => (i === index ? updated : s)),
            );
          }}
          onScheduleItemUpdate={(taskId, newStart, newEnd) => {
            setSchedule((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                scheduled: prev.scheduled.map((item) =>
                  item.task_id === taskId
                    ? { ...item, start_time: newStart, end_time: newEnd }
                    : item,
                ),
              };
            });
          }}
        />
        
        
      </div>

      {/* Chat */}
      <div className="w-72 shrink-0 bg-white flex flex-col h-full">
        <ChatPanel />
      </div>
      
    </div>
  );
}
