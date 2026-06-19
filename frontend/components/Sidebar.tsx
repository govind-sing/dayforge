'use client'

import { useState } from 'react'
import { TaskFormData } from './TaskRow'
import LogoutButton from './LogoutButton'

interface Props {
  date: string
  highTasks: TaskFormData[]
  mediumTasks: TaskFormData[]
  lowTasks: TaskFormData[]
  isGenerating: boolean
  onGenerate: () => void
  onToggleDone: (taskId: string, isDone: boolean) => void
  onAddTask: (task: Omit<TaskFormData, 'id' | 'status'>) => Promise<void>
  onEditTask: (taskId: string, updates: Partial<TaskFormData>) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
}

const priorityConfig = {
  high: { label: 'High Priority', dot: 'bg-red-400', ring: 'focus:ring-red-300' },
  medium: { label: 'Medium Priority', dot: 'bg-yellow-400', ring: 'focus:ring-yellow-300' },
  low: { label: 'Low Priority', dot: 'bg-green-400', ring: 'focus:ring-green-300' },
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
      <div className="bg-gray-50 rounded-lg p-2 space-y-1.5 border">
        <input
          autoFocus
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          placeholder="Task title"
          className="w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <input
          value={editDesc}
          onChange={e => setEditDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <input
          type="number"
          value={editMinutes}
          onChange={e => setEditMinutes(Number(e.target.value))}
          min={5}
          max={480}
          step={5}
          className="w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <div className="flex gap-1.5">
          <button
            onClick={handleSaveEdit}
            disabled={saving || !editTitle.trim()}
            className="flex-1 bg-violet-600 text-white text-xs rounded px-2 py-1 hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="flex-1 border text-xs rounded px-2 py-1 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg group transition-colors ${isDone ? 'opacity-50' : 'hover:bg-gray-50'}`}>
      {/* Tick */}
      <button
        onClick={() => id && onToggleDone(id, !isDone)}
        className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
          isDone ? 'bg-green-400 border-green-400 text-white' : 'border-gray-300 hover:border-green-400'
        }`}
      >
        {isDone && (
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-gray-400 truncate">{task.description}</p>
        )}
        <p className="text-xs text-gray-400">{task.estimated_minutes} mins</p>
      </div>

      {/* Actions - visible on hover */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => { setIsEditing(true); setConfirmDelete(false) }}
          className="text-gray-400 hover:text-violet-600 text-xs p-0.5"
          title="Edit"
        >
          ✏️
        </button>
        <button
          onClick={handleDelete}
          className={`text-xs p-0.5 ${confirmDelete ? 'text-red-600 font-bold' : 'text-gray-400 hover:text-red-500'}`}
          title={confirmDelete ? 'Click again to confirm' : 'Delete'}
        >
          {confirmDelete ? 'confirm?' : '🗑️'}
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-2 space-y-1.5 border mt-1">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task title"
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        className="w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
      />
      <input
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
      />
      <input
        type="number"
        value={minutes}
        onChange={e => setMinutes(Number(e.target.value))}
        min={5}
        max={480}
        step={5}
        className="w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
      />
      <div className="flex gap-1.5">
        <button
          onClick={handleAdd}
          disabled={saving || !title.trim()}
          className="flex-1 bg-violet-600 text-white text-xs rounded px-2 py-1 hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? 'Adding...' : 'Add'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 border text-xs rounded px-2 py-1 hover:bg-gray-100"
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
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${config.dot}`} />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {config.label}
          </span>
        </div>
        <span className="text-xs text-gray-400">{validTasks.length}/3</span>
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
          className="w-full text-left text-xs text-gray-400 hover:text-violet-600 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
        >
          + Add task
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
  onGenerate,
  onToggleDone,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: Props) {
  const allTasks = [...highTasks, ...mediumTasks, ...lowTasks].filter(t => t.title.trim() !== '')
  const completedCount = allTasks.filter(t => t.status === 'completed').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900">DayForge</h1>
          <p className="text-xs text-gray-400">{completedCount}/{allTasks.length} done today</p>
        </div>
        <LogoutButton />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
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

      {/* Generate button */}
      <div className="p-4 border-t space-y-2">
        <p className="text-xs text-center text-gray-400">{date}</p>
        <button
          onClick={onGenerate}
          disabled={isGenerating || allTasks.length === 0}
          className="w-full py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generating...
            </span>
          ) : '✨ Generate Schedule'}
        </button>
      </div>
    </div>
  )
}