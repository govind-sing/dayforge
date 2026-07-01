'use client'

import { useState } from 'react'
import { TaskFormData } from './TaskRow'
import { useRouter } from 'next/navigation'

interface Props {
  date: string
  highTasks: TaskFormData[]
  mediumTasks: TaskFormData[]
  lowTasks: TaskFormData[]
  isGenerating: boolean
  hasSchedule: boolean
  onGenerate: () => void
  onToggleDone: (taskId: string, isDone: boolean) => void
  onAddTask: (task: Omit<TaskFormData, 'id' | 'status'>) => Promise<void>
  onEditTask: (taskId: string, updates: Partial<TaskFormData>) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
}

const priorityConfig = {
  high: { label: 'High Priority', color: 'bg-rose-500' },
  medium: { label: 'Medium Priority', color: 'bg-amber-500' },
  low: { label: 'Low Priority', color: 'bg-emerald-500' },
}

interface TaskItemProps {
  task: TaskFormData
  onToggleDone: (taskId: string, isDone: boolean) => void
  onEdit: (taskId: string, updates: Partial<TaskFormData>) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
}

function TaskItem({ task, onToggleDone, onEdit, onDelete }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editMinutes, setEditMinutes] = useState(task.estimated_minutes)
  const [editDesc, setEditDesc] = useState(task.description || '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isDone = task.status === 'completed'
  const id = task.id

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !id) return
    setSaving(true)
    try {
      await onEdit(id, {
        title: editTitle,
        description: editDesc,
        estimated_minutes: editMinutes,
      })
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await onDelete(id)
  }

  if (isEditing) {
    return (
      <div className="bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 space-y-3">
        <input
          autoFocus
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          placeholder="Task title"
          className="w-full bg-white dark:bg-[#0c0c0b] border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400"
        />
        <input
          value={editDesc}
          onChange={e => setEditDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full bg-white dark:bg-[#0c0c0b] border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400"
        />
        <input
          type="number"
          value={editMinutes}
          onChange={e => setEditMinutes(Number(e.target.value))}
          min={5}
          max={480}
          step={5}
          className="w-full bg-white dark:bg-[#0c0c0b] border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400"
        />
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSaveEdit}
            disabled={saving || !editTitle.trim()}
            className="flex-1 bg-[#0f0e0c] dark:bg-[#f0ede8] text-[#f5f4f0] dark:text-[#0c0c0b] font-medium rounded-xl py-2.5 text-sm"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="flex-1 border border-stone-200 dark:border-stone-800 rounded-xl py-2.5 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-2xl group transition-all ${isDone ? 'opacity-60' : 'hover:bg-stone-100 dark:hover:bg-stone-900'}`}>
      <button
        onClick={() => id && onToggleDone(id, !isDone)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
          isDone 
            ? 'bg-emerald-500 border-emerald-500' 
            : 'border-stone-300 dark:border-stone-700 hover:border-emerald-500'
        }`}
      >
        {isDone && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0 pt-0.5">
        <p className={`font-medium text-[15px] leading-tight truncate ${isDone ? 'line-through text-stone-400' : 'text-[#0f0e0c] dark:text-[#f0ede8]'}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 line-clamp-1">{task.description}</p>
        )}
        <p className="text-xs text-stone-400 mt-1.5">{task.estimated_minutes} min</p>
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
        <button
          onClick={() => { setIsEditing(true); setConfirmDelete(false) }}
          className="p-2 text-stone-400 hover:text-[#0f0e0c] dark:hover:text-[#f0ede8] rounded-xl hover:bg-stone-200 dark:hover:bg-stone-800"
          title="Edit"
        >
          ✏️
        </button>
        <button
          onClick={handleDelete}
          className={`p-2 rounded-xl ${confirmDelete ? 'text-rose-500 font-medium' : 'text-stone-400 hover:text-rose-500'}`}
          title={confirmDelete ? 'Click again to confirm delete' : 'Delete'}
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

interface AddTaskFormProps {
  priority: 'high' | 'medium' | 'low'
  onAdd: (task: Omit<TaskFormData, 'id' | 'status'>) => Promise<void>
  onCancel: () => void
}

function AddTaskForm({ priority, onAdd, onCancel }: AddTaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onAdd({ title, description, estimated_minutes: minutes, priority })
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 space-y-3 mt-1">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="New task title"
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        className="w-full bg-white dark:bg-[#0c0c0b] border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400"
      />
      <input
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full bg-white dark:bg-[#0c0c0b] border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400"
      />
      <input
        type="number"
        value={minutes}
        onChange={e => setMinutes(Number(e.target.value))}
        min={5}
        max={480}
        step={5}
        className="w-full bg-white dark:bg-[#0c0c0b] border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-stone-400"
      />
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={saving || !title.trim()}
          className="flex-1 bg-[#0f0e0c] dark:bg-[#f0ede8] text-[#f5f4f0] dark:text-[#0c0c0b] font-medium rounded-xl py-2.5 text-sm"
        >
          {saving ? 'Adding...' : 'Add Task'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 border border-stone-200 dark:border-stone-800 rounded-xl py-2.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function PrioritySection({
  priority,
  tasks,
  onToggleDone,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: {
  priority: 'high' | 'medium' | 'low'
  tasks: TaskFormData[]
  onToggleDone: (taskId: string, isDone: boolean) => void
  onAddTask: (task: Omit<TaskFormData, 'id' | 'status'>) => Promise<void>
  onEditTask: (taskId: string, updates: Partial<TaskFormData>) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const config = priorityConfig[priority]
  const validTasks = tasks.filter(t => t.title.trim() !== '')
  const canAdd = validTasks.length < 3

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
          <span className="text-xs font-semibold uppercase tracking-[0.5px] text-stone-400 dark:text-stone-500">
            {config.label}
          </span>
        </div>
        <span className="text-xs text-stone-400">{validTasks.length}/3</span>
      </div>

      {validTasks.map((task, i) => (
        <TaskItem
          key={task.id || i}
          task={task}
          onToggleDone={onToggleDone}
          onEdit={onEditTask}
          onDelete={onDeleteTask}
        />
      ))}

      {showForm && (
        <AddTaskForm
          priority={priority}
          onAdd={async (task) => {
            await onAddTask(task)
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {canAdd && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full text-left text-sm text-stone-400 hover:text-[#0f0e0c] dark:hover:text-[#f0ede8] px-3 py-3 rounded-2xl hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors flex items-center gap-2"
        >
          <span>+</span> Add task
        </button>
      )}
    </div>
  )
}

export default function Sidebar({
  date,
  highTasks,
  mediumTasks,
  lowTasks,
  isGenerating,
  hasSchedule,
  onGenerate,
  onToggleDone,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: Props) {
  const allTasks = [...highTasks, ...mediumTasks, ...lowTasks].filter(t => t.title.trim() !== '')
  const completedCount = allTasks.filter(t => t.status === 'completed').length
  const router = useRouter()

  return (
    <div className="font-dm flex flex-col h-full bg-[#f5f4f0] dark:bg-[#0c0c0b] text-[#0f0e0c] dark:text-[#f0ede8] border-r border-stone-200 dark:border-stone-800">
      {/* Header */}
      <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
        <div>
          <h1 className="font-syne text-[28px] font-bold tracking-tighter">DayForge</h1>
          <p className="text-xs text-stone-400 dark:text-stone-600">
            {completedCount}/{allTasks.length} completed today
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push('/help')}
            title="Help"
            className="p-3 rounded-2xl text-stone-400 hover:text-[#0f0e0c] dark:hover:text-[#f0ede8] hover:bg-stone-100 dark:hover:bg-stone-900 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.126-1.265 3.02-1.265 4.146 0 1.126 1.265 1.126 3.325 0 4.59-.468.525-.936 1.2-.936 1.89v.5" />
              <circle cx="12" cy="17.5" r="1" fill="currentColor" />
            </svg>
          </button>

          <button
            onClick={() => router.push('/profile')}
            title="Profile"
            className="p-3 rounded-2xl text-stone-400 hover:text-[#0f0e0c] dark:hover:text-[#f0ede8] hover:bg-stone-100 dark:hover:bg-stone-900 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="8" r="4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-5 space-y-8">
        <PrioritySection
          priority="high"
          tasks={highTasks}
          onToggleDone={onToggleDone}
          onAddTask={onAddTask}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
        />
        <PrioritySection
          priority="medium"
          tasks={mediumTasks}
          onToggleDone={onToggleDone}
          onAddTask={onAddTask}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
        />
        <PrioritySection
          priority="low"
          tasks={lowTasks}
          onToggleDone={onToggleDone}
          onAddTask={onAddTask}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
        />
      </div>

      {/* Generate Section */}
      <div className="p-5 border-t border-stone-200 dark:border-stone-800 space-y-3">
        <p className="text-center text-xs text-stone-400 dark:text-stone-600">{date}</p>

        {hasSchedule ? (
          <p className="text-center text-xs text-stone-400 py-4">
            Schedule generated — ask Jarvis to adjust
          </p>
        ) : (
          <button
            onClick={onGenerate}
            disabled={isGenerating || allTasks.length === 0}
            className="w-full py-3.5 bg-[#0f0e0c] dark:bg-[#f0ede8] text-[#f5f4f0] dark:text-[#0c0c0b] font-semibold rounded-2xl text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generating Schedule...
              </>
            ) : '✨ Generate Daily Schedule'}
          </button>
        )}
      </div>
    </div>
  )
}