"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  onScheduleItemUpdate: (
    taskId: string,
    newStart: string,
    newEnd: string,
  ) => void;
  completedTaskIds: Set<string>;
}

interface SlotModal {
  start: string;
  end: string;
}

const priorityColors: Record<string, string> = {
  high: "#f87171",
  medium: "#facc15",
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

  // Build FullCalendar events from schedule + blocked slots
  const events = [
    // Scheduled tasks
    ...(schedule?.scheduled ?? []).map((item) => ({
      id: `task-${item.task_id}`,
      title: item.title,
      start: `${date}T${item.start_time}:00`,
      end: `${date}T${item.end_time}:00`,
      backgroundColor:
        completedTaskIds.has(item.task_id) || item.is_done
          ? "#9ca3af"
          : (priorityColors[item.priority] ?? "#a78bfa"),
      borderColor: "transparent",
      textColor: "#1f2937",
      extendedProps: {
        type: "task",
        taskId: item.task_id,
        priority: item.priority,
        reasoning: item.reasoning,
        isDone: completedTaskIds.has(item.task_id) || item.is_done,
      },
    })),

    // Blocked slots
    ...blockedSlots.map((slot, i) => ({
      id: `blocked-${i}`,
      title: `🚫 ${slot.label}`,
      start: `${date}T${slot.start_time}`,
      end: `${date}T${slot.end_time}`,
      backgroundColor: "#e5e7eb",
      borderColor: "#9ca3af",
      textColor: "#6b7280",
      resizable: true,
      extendedProps: {
        type: "blocked",
        index: i,
      },
    })),
  ];

  const handleDateSet = (info: any) => {
    const newDate = info.startStr.split("T")[0];
    if (newDate !== date) onDateChange(newDate);
  };

  const handleSelect = (info: any) => {
    setLabel("");
    setModal({
      start: info.startStr.slice(11, 16),
      end: info.endStr.slice(11, 16),
    });
  };

  const handleSaveBlockedSlot = () => {
    if (!modal || !label.trim()) return;
    onBlockedSlotAdd({
      label,
      start_time: modal.start,
      end_time: modal.end,
      recurrence: "none",
      active_from: date,
    });
    setModal(null);
    setLabel("");
  };

  const handleEventDrop = async (info: any) => {
    const { type, taskId, index } = info.event.extendedProps;
    const newStart = info.event.startStr.slice(11, 16);
    const newEnd = info.event.endStr.slice(11, 16);

    if (type === "task") {
      onScheduleItemUpdate(taskId, newStart, newEnd);
      await updateScheduleItem(taskId, date, newStart, newEnd);
    } else if (type === "blocked") {
      const slot = blockedSlots[index];
      onBlockedSlotUpdate(index, {
        ...slot,
        start_time: newStart,
        end_time: newEnd,
      });
      if ((slot as any).id) {
        await updateBlockedSlot((slot as any).id, newStart, newEnd);
      }
    }
  };

  const handleEventResize = async (info: any) => {
    const { type, taskId, index } = info.event.extendedProps;
    const newStart = info.event.startStr.slice(11, 16);
    const newEnd = info.event.endStr.slice(11, 16);

    if (type === "task") {
      onScheduleItemUpdate(taskId, newStart, newEnd);
      await updateScheduleItem(taskId, date, newStart, newEnd);
    } else if (type === "blocked") {
      const slot = blockedSlots[index];
      onBlockedSlotUpdate(index, {
        ...slot,
        start_time: newStart,
        end_time: newEnd,
      });
      if ((slot as any).id) {
        await updateBlockedSlot((slot as any).id, newStart, newEnd);
      }
    }
  };

  const handleEventClick = (info: any) => {
    const { type, taskId, isDone } = info.event.extendedProps;
    if (type === "task") {
      onToggleDone(taskId, !isDone);
    }
  };

  const goToday = () => {
    calendarRef.current?.getApi().today();
    onDateChange(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Today button */}
      <div className="px-4 pt-3 pb-1 flex justify-end border-b">
        <button
          onClick={goToday}
          className="text-xs px-3 py-1 rounded-lg border border-violet-300 text-violet-600 hover:bg-violet-50 transition-colors"
        >
          Today
        </button>
      </div>

      {/* FullCalendar */}
      <div className="flex-1 overflow-hidden px-2 pb-2">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridDay"
          initialDate={date}
          headerToolbar={{
            left: "prev",
            center: "title",
            right: "next",
          }}
          height="100%"
          slotMinTime="05:00:01"
          slotMaxTime="23:59:59"
          slotDuration="00:30:00"
          snapDuration="00:30:00"
          allDaySlot={false}
          selectable={true}
          selectMirror={true}
          editable={true}
          eventResizableFromStart={false}
          events={events}
          datesSet={handleDateSet}
          select={handleSelect}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={handleEventClick}
          eventContent={(info) => {
            const { type, isDone } = info.event.extendedProps;
            return (
              <div className="p-1 h-full flex flex-col justify-between overflow-hidden">
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`text-xs font-semibold truncate ${isDone ? "line-through opacity-60" : ""}`}
                  >
                    {info.event.title}
                  </span>
                  {type === "task" && (
                    <span
                      className={`text-xs shrink-0 ${isDone ? "text-green-600" : "text-gray-400"}`}
                    >
                      {isDone ? "✓" : "○"}
                    </span>
                  )}
                </div>
                <span className="text-xs opacity-70">{info.timeText}</span>
              </div>
            );
          }}
        />
      </div>

      {/* Blocked slot modal */}
      {modal && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-72 space-y-4">
            <h3 className="font-semibold text-gray-800">Add Blocked Slot</h3>
            <p className="text-sm text-gray-500">
              {modal.start} – {modal.end}
            </p>
            <input
              autoFocus
              placeholder="Label (e.g. Lunch, Class)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveBlockedSlot()}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBlockedSlot}
                disabled={!label.trim()}
                className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm hover:bg-violet-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
