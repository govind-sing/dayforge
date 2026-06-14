'use client'

import TaskRow, { TaskFormData } from './TaskRow'

interface Props {
  level: 'high' | 'medium' | 'low'
  tasks: TaskFormData[]
  onChange: (tasks: TaskFormData[]) => void
}

const LEVEL_STYLES: Record<string, string> = {
  high: 'border-red-300 bg-red-50',
  medium: 'border-yellow-300 bg-yellow-50',
  low: 'border-green-300 bg-green-50',
}

const emptyTask = (priority: 'high' | 'medium' | 'low'): TaskFormData => ({
  title: '', description: '', estimated_minutes: 30, priority
})

export default function PriorityBlockForm({ level, tasks, onChange }: Props) {
  const updateTask = (index: number, task: TaskFormData) => {
    const next = [...tasks]
    next[index] = task
    onChange(next)
  }

  const addTask = () => {
    if (tasks.length >= 3) return
    onChange([...tasks, emptyTask(level)])
  }

  const removeTask = (index: number) => {
    onChange(tasks.filter((_, i) => i !== index))
  }

  return (
    <div className={`border-2 rounded-lg p-4 ${LEVEL_STYLES[level]}`}>
      <h3 className="font-semibold capitalize mb-2">{level} Priority</h3>

      {tasks.map((task, i) => (
        <TaskRow key={i} task={task} onChange={(t) => updateTask(i, t)} onRemove={() => removeTask(i)} />
      ))}

      {tasks.length < 3 && (
        <button type="button" onClick={addTask} className="text-sm text-blue-600 mt-1">
          + Add task ({tasks.length}/3)
        </button>
      )}
    </div>
  )
}