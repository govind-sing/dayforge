"use client";

import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { ScheduleResponse } from "@/types/schedule";
import { BlockedSlotFormData } from "./BlockedSlotsForm";
import { updateScheduleItem, updateBlockedSlot } from "@/lib/api";

interface Props {
  date: string;
  schedule: ScheduleResponse | null;
  blockedSlots: BlockedSlotFormData[];
  onDateChange: (date: string) => void;
  onToggleDone: (taskId: string, isDone: boolean) => void;
  onBlockedSlotAdd: (slot: BlockedSlotFormData) => Promise<void>;
  onBlockedSlotUpdate: (index: number, slot: BlockedSlotFormData) => void;
  onScheduleItemUpdate: (taskId: string, newStart: string, newEnd: string) => void;
  completedTaskIds: Set<string>;
}

interface SlotModal {
  start: string;
  end: string;
}

interface DateSetInfo {
  startStr: string;
}

interface SelectInfo {
  startStr: string;
  endStr: string;
}

interface ExtendedProps {
  type: "task" | "blocked";
  taskId?: string;
  priority?: string;
  isDone?: boolean;
  index?: number;
}

const priorityColors: Record<string, string> = {
  high: "#f87171",
  medium: "#fbbf24",
  low: "#4ade80",
};

export default function CalendarView({
  date,
  schedule,
  blockedSlots,
  onDateChange,
  onToggleDone,
  onBlockedSlotAdd,
  onBlockedSlotUpdate,
  onScheduleItemUpdate,
  completedTaskIds,
}: Props) {
  const calendarRef = useRef<FullCalendar>(null);
  const [modal, setModal] = useState<SlotModal | null>(null);
  const [label, setLabel] = useState("");

  const events = [
    ...(schedule?.scheduled ?? []).map((item) => ({
      id: `task-${item.task_id}`,
      title: item.title,
      start: `${date}T${item.start_time}:00`,
      end: `${date}T${item.end_time}:00`,
      backgroundColor: completedTaskIds.has(item.task_id) || item.is_done
        ? "#9ca3af"
        : (priorityColors[item.priority] ?? "#a78bfa"),
      borderColor: "transparent",
      textColor: "#1f2937",
      extendedProps: {
        type: "task" as const,
        taskId: item.task_id,
        priority: item.priority,
        isDone: completedTaskIds.has(item.task_id) || item.is_done,
      },
    })),

    ...blockedSlots.map((slot, i) => ({
      id: `blocked-${i}`,
      title: `🚫 ${slot.label}`,
      start: `${date}T${slot.start_time}`,
      end: `${date}T${slot.end_time}`,
      backgroundColor: "#e5e7eb",
      borderColor: "#9ca3af",
      textColor: "#6b7280",
      editable: true,
      extendedProps: { 
        type: "blocked" as const, 
        index: i 
      },
    })),
  ];

  const handleDateSet = (info: DateSetInfo): void => {
    const newDate = info.startStr.split("T")[0];
    if (newDate !== date) onDateChange(newDate);
  };

  const handleSelect = (info: SelectInfo): void => {
    setLabel("");
    setModal({
      start: info.startStr.slice(11, 16),
      end: info.endStr.slice(11, 16),
    });
  };

  const handleSaveBlockedSlot = (): void => {
    if (!modal || !label.trim()) return;
    onBlockedSlotAdd({
      label,
      start_time: modal.start,
      end_time: modal.end,
      active_from: date,
    });
    setModal(null);
    setLabel("");
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventDrop = async (info: any): Promise<void> => {
    const { type, taskId, index } = info.event.extendedProps as ExtendedProps;
    const newStart = info.event.startStr.slice(11, 16);
    const newEnd = info.event.endStr.slice(11, 16);

    if (type === "task" && taskId) {
      onScheduleItemUpdate(taskId, newStart, newEnd);
      await updateScheduleItem(taskId, date, newStart, newEnd);
    } else if (type === "blocked" && index !== undefined) {
      const slot = blockedSlots[index];
      onBlockedSlotUpdate(index, { ...slot, start_time: newStart, end_time: newEnd });
      
      // Check if slot has id property for API call
      if ("id" in slot && slot.id) {
        await updateBlockedSlot(slot.id as string, newStart, newEnd);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventResize = async (info: any): Promise<void> => {
    const { type, taskId, index } = info.event.extendedProps as ExtendedProps;
    const newStart = info.event.startStr.slice(11, 16);
    const newEnd = info.event.endStr.slice(11, 16);

    if (type === "task" && taskId) {
      onScheduleItemUpdate(taskId, newStart, newEnd);
      await updateScheduleItem(taskId, date, newStart, newEnd);
    } else if (type === "blocked" && index !== undefined) {
      const slot = blockedSlots[index];
      onBlockedSlotUpdate(index, { ...slot, start_time: newStart, end_time: newEnd });
      
      if ("id" in slot && slot.id) {
        await updateBlockedSlot(slot.id as string, newStart, newEnd);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventClick = (info: any): void => {
    const { type, taskId, isDone } = info.event.extendedProps as ExtendedProps;
    if (type === "task" && taskId) {
      onToggleDone(taskId, !isDone);
    }
  };

  const goToday = (): void => {
    calendarRef.current?.getApi().today();
    onDateChange(new Date().toISOString().split("T")[0]);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        .font-syne { font-family: 'Syne', sans-serif; }
        .font-dm { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div className="font-dm flex flex-col h-full bg-[#f5f4f0] dark:bg-[#0c0c0b] text-[#0f0e0c] dark:text-[#f0ede8]">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-stone-200 dark:border-stone-800/60 flex items-center justify-between bg-[#f5f4f0]/80 dark:bg-[#0c0c0b]/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <h2 className="font-syne text-2xl font-bold tracking-tight">Schedule</h2>
            <span className="text-sm text-stone-400 dark:text-stone-600 font-light">
              {new Date(date).toLocaleDateString("en-IN", { 
                weekday: "long", 
                month: "long", 
                day: "numeric" 
              })}
            </span>
          </div>

          <button
            onClick={goToday}
            className="px-4 py-2 text-[13px] font-semibold bg-[#0f0e0c] dark:bg-[#f0ede8] text-[#f5f4f0] dark:text-[#0c0c0b] rounded-xl hover:opacity-90 transition-all"
          >
            Today
          </button>
        </div>

        {/* Calendar Container */}
        <div className="flex-1 p-5 overflow-hidden">
          <div className="h-full bg-stone-100 dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView="timeGridDay"
              initialDate={date}
              headerToolbar={{
                left: "prev,next",
                center: "title",
                right: "",
              }}
              height="100%"
              slotMinTime="05:00:00"
              slotMaxTime="23:59:59"
              slotDuration="00:30:00"
              snapDuration="00:30:00"
              allDaySlot={false}
              selectable={true}
              selectMirror={true}
              editable={true}
              events={events}
              datesSet={handleDateSet}
              select={handleSelect}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              eventClick={handleEventClick}
              eventContent={(info) => {
                const { type, isDone } = info.event.extendedProps as ExtendedProps;
                return (
                  <div className="p-1.5 h-full flex flex-col justify-between overflow-hidden">
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={`text-sm font-medium leading-tight truncate ${isDone ? "line-through opacity-60" : ""}`}
                      >
                        {info.event.title}
                      </span>
                      {type === "task" && (
                        <span className={`text-xs mt-0.5 ${isDone ? "text-emerald-600" : "text-stone-400"}`}>
                          {isDone ? "✓" : "○"}
                        </span>
                      )}
                    </div>
                    <span className="text-xs opacity-70 font-medium">{info.timeText}</span>
                  </div>
                );
              }}
            />
          </div>
        </div>

        {/* Blocked Slot Modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-xl p-6 w-full max-w-sm mx-4">
              <h3 className="font-syne text-xl font-bold mb-1">Block Time Slot</h3>
              <p className="text-stone-500 dark:text-stone-400 mb-5">
                {modal.start} — {modal.end}
              </p>

              <input
                autoFocus
                placeholder="What are you blocking? (Lunch, Meeting, Focus, etc.)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveBlockedSlot()}
                className="w-full bg-white dark:bg-[#0c0c0b] border border-stone-200 dark:border-stone-700 rounded-2xl px-4 py-3.5 text-[15px] focus:border-stone-400 dark:focus:border-stone-600 outline-none mb-6"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setModal(null)}
                  className="flex-1 py-3 text-sm font-semibold border border-stone-200 dark:border-stone-700 rounded-2xl hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBlockedSlot}
                  disabled={!label.trim()}
                  className="flex-1 py-3 text-sm font-semibold bg-[#0f0e0c] dark:bg-[#f0ede8] text-[#f5f4f0] dark:text-[#0c0c0b] rounded-2xl disabled:opacity-50 transition-all"
                >
                  Save Blocked Slot
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}