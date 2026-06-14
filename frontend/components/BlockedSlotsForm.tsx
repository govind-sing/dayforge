'use client'

import { useState } from 'react'

export interface BlockedSlotFormData {
  label: string
  start_time: string
  end_time: string
  recurrence: 'none' | 'daily' | 'weekdays' | 'weekly'
}

interface Props {
  slots: BlockedSlotFormData[]
  onChange: (slots: BlockedSlotFormData[]) => void
}

export default function BlockedSlotsForm({ slots, onChange }: Props) {
  const [draft, setDraft] = useState<BlockedSlotFormData>({
    label: '', start_time: '09:00', end_time: '10:00', recurrence: 'weekdays'
  })

  const addSlot = () => {
    if (!draft.label) return
    onChange([...slots, draft])
    setDraft({ label: '', start_time: '09:00', end_time: '10:00', recurrence: 'weekdays' })
  }

  const removeSlot = (index: number) => {
    onChange(slots.filter((_, i) => i !== index))
  }

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold mb-2">Blocked Time Slots</h3>

      {slots.map((slot, i) => (
        <div key={i} className="flex justify-between items-center text-sm py-1">
          <span>{slot.label} — {slot.start_time} to {slot.end_time} ({slot.recurrence})</span>
          <button onClick={() => removeSlot(i)} className="text-red-500">✕</button>
        </div>
      ))}

      <div className="flex gap-2 mt-2">
        <input
          placeholder="Label (e.g. Biotech Lab)"
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
        <select
          value={draft.recurrence}
          onChange={(e) => setDraft({ ...draft, recurrence: e.target.value as any })}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="none">Once</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">Weekly</option>
        </select>
        <button type="button" onClick={addSlot} className="bg-blue-600 text-white rounded px-3 py-1 text-sm">
          Add
        </button>
      </div>
    </div>
  )
}