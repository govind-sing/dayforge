"use client";

import { useState } from "react";

export interface BlockedSlotFormData {
  id?: string;
  label: string;
  start_time: string;
  end_time: string;
  recurrence?: "none" | "daily" | "weekdays" | "weekly";
  active_from?: string;
}

interface Props {
  slots: BlockedSlotFormData[];
  onChange: (slots: BlockedSlotFormData[]) => void;
}

const defaultDraft: BlockedSlotFormData = {
  label: "",
  start_time: "09:00",
  end_time: "10:00",
};

export default function BlockedSlotsForm({ slots, onChange }: Props) {
  const [draft, setDraft] = useState<BlockedSlotFormData>(defaultDraft);

  const addSlot = () => {
    if (!draft.label.trim()) return;
    onChange([...slots, { ...draft }]);
    setDraft(defaultDraft);
  };

  const removeSlot = (index: number) => {
    onChange(slots.filter((_, i) => i !== index));
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold">Blocked Time Slots</h3>

      {slots.map((slot, i) => (
        <div key={i} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
          <span className="text-gray-700">
            <span className="font-medium">{slot.label}</span>
            {" — "}
            {slot.start_time} to {slot.end_time}
          </span>
          <button onClick={() => removeSlot(i)} className="text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          placeholder="Label (e.g. Lunch)"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
        <input
          type="time"
          value={draft.start_time}
          onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          type="time"
          value={draft.end_time}
          onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
          className="border rounded px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={addSlot}
          className="bg-blue-600 text-white rounded px-3 py-1 text-sm hover:bg-blue-700"
        >
          Add
        </button>
      </div>
    </div>
  );
}