'use client'

export interface TaskFormData {
  id?: string
  title: string
  description: string
  estimated_minutes: number
  priority: 'high' | 'medium' | 'low'
  status?: string
}

interface Props {
  task: TaskFormData
  onChange: (task: TaskFormData) => void
  onRemove: () => void
}

export default function TaskRow({ task, onChange, onRemove }: Props) {
  return (
    <div className="flex gap-2 items-start mb-2">
      <input
        type="text"
        placeholder="Task title"
        value={task.title}
        onChange={(e) => onChange({ ...task, title: e.target.value })}
        className="flex-1 border rounded px-2 py-1 text-sm"
      />
      <input
        type="number"
        placeholder="mins"
        min={5}
        max={480}
        step={5}
        value={task.estimated_minutes}
        onChange={(e) => onChange({ ...task, estimated_minutes: Number(e.target.value) })}
        className="w-20 border rounded px-2 py-1 text-sm"
      />
      <button type="button" onClick={onRemove} className="text-red-500 text-sm px-2">
        ✕
      </button>
    </div>
  )
}