import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { TaskFormData, apiPost, apiPatch, apiDelete } from '../lib/api'

interface Props {
  date: string
  highTasks: TaskFormData[]
  mediumTasks: TaskFormData[]
  lowTasks: TaskFormData[]
  hasSchedule: boolean
  isGenerating: boolean
  onGenerate: () => void
  onToggleDone: (taskId: string, isDone: boolean) => void
  onClose: () => void
  onDataChange: () => void
}

const priorityConfig = {
  high: { label: 'High Priority', color: '#f87171' },
  medium: { label: 'Medium Priority', color: '#fbbf24' },
  low: { label: 'Low Priority', color: '#4ade80' },
}

interface TaskItemProps {
  task: TaskFormData
  onToggleDone: (taskId: string, isDone: boolean) => void
  onDataChange: () => void
}

function TaskItem({ task, onToggleDone, onDataChange }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editMinutes, setEditMinutes] = useState(String(task.estimated_minutes))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isDone = task.status === 'completed'

  const handleSave = async () => {
    if (!editTitle.trim() || !task.id) return
    setSaving(true)
    try {
      await apiPatch(`/api/tasks/${task.id}`, {
        title: editTitle,
        estimated_minutes: Number(editMinutes),
      })
      onDataChange()
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task.id) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await apiDelete(`/api/tasks/${task.id}`)
    onDataChange()
  }

  if (isEditing) {
    return (
      <View style={styles.editCard}>
        <TextInput
          style={styles.editInput}
          value={editTitle}
          onChangeText={setEditTitle}
          placeholder="Task title"
          placeholderTextColor="#a8a29e"
          autoFocus
        />
        <TextInput
          style={styles.editInput}
          value={editMinutes}
          onChangeText={setEditMinutes}
          keyboardType="numeric"
          placeholder="Minutes"
          placeholderTextColor="#a8a29e"
        />
        <View style={styles.editActions}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#f5f4f0" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setIsEditing(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.taskRow}>
      <TouchableOpacity
        style={[styles.checkbox, isDone && styles.checkboxDone]}
        onPress={() => task.id && onToggleDone(task.id, !isDone)}
      >
        {isDone && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
          {task.title}
        </Text>
        <Text style={styles.taskMeta}>{task.estimated_minutes} min</Text>
      </View>

      <View style={styles.taskActions}>
        <TouchableOpacity onPress={() => { setIsEditing(true); setConfirmDelete(false) }}>
          <Text style={styles.actionIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={[styles.actionIcon, confirmDelete && styles.deleteConfirm]}>
            🗑️
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

interface AddTaskFormProps {
  priority: 'high' | 'medium' | 'low'
  date: string
  onDone: () => void
  allTasks: TaskFormData[]
}

function AddTaskForm({ priority, date, onDone, allTasks }: AddTaskFormProps) {
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
  if (!title.trim()) return
  setSaving(true)
  try {
    await apiPost('/api/tasks/daily-plan', {
      plan_date: date,
      title,
      description: '',
      estimated_minutes: Number(minutes),
      priority,
    })
    onDone()
  } finally {
    setSaving(false)
  }
}

  return (
    <View style={styles.editCard}>
      <TextInput
        style={styles.editInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Task title"
        placeholderTextColor="#a8a29e"
        autoFocus
      />
      <TextInput
        style={styles.editInput}
        value={minutes}
        onChangeText={setMinutes}
        keyboardType="numeric"
        placeholder="Minutes"
        placeholderTextColor="#a8a29e"
      />
      <View style={styles.editActions}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleAdd}
          disabled={saving || !title.trim()}
        >
          {saving ? (
            <ActivityIndicator color="#f5f4f0" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Add</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onDone}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

interface PrioritySectionProps {
  priority: 'high' | 'medium' | 'low'
  tasks: TaskFormData[]
  allTasks: TaskFormData[]
  date: string
  onToggleDone: (taskId: string, isDone: boolean) => void
  onDataChange: () => void
}

function PrioritySection({ priority, tasks, allTasks, date, onToggleDone, onDataChange }: PrioritySectionProps) {
  const [showForm, setShowForm] = useState(false)
  const config = priorityConfig[priority]
  const validTasks = tasks.filter(t => t.title.trim() !== '')
  const canAdd = validTasks.length < 3

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.priorityDot, { backgroundColor: config.color }]} />
        <Text style={styles.sectionLabel}>{config.label}</Text>
        <Text style={styles.sectionCount}>{validTasks.length}/3</Text>
      </View>

      {validTasks.map((task, i) => (
        <TaskItem
          key={task.id || i}
          task={task}
          onToggleDone={onToggleDone}
          onDataChange={onDataChange}
        />
      ))}

      {showForm && (
        <AddTaskForm
          priority={priority}
          date={date}
          allTasks={allTasks}
          onDone={() => {
            setShowForm(false)
            onDataChange()
          }}
        />
      )}

      {canAdd && !showForm && (
        <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
          <Text style={styles.addButtonText}>+ Add task</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function Sidebar({
  date,
  highTasks,
  mediumTasks,
  lowTasks,
  hasSchedule,
  isGenerating,
  onGenerate,
  onToggleDone,
  onClose,
  onDataChange,
}: Props) {
  const allTasks = [...highTasks, ...mediumTasks, ...lowTasks]
  const completedCount = allTasks.filter(t => t.status === 'completed').length

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>DayForge</Text>
          <Text style={styles.progress}>{completedCount}/{allTasks.length} completed</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tasks */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <PrioritySection
          priority="high"
          tasks={highTasks}
          allTasks={allTasks}
          date={date}
          onToggleDone={onToggleDone}
          onDataChange={onDataChange}
        />
        <PrioritySection
          priority="medium"
          tasks={mediumTasks}
          allTasks={allTasks}
          date={date}
          onToggleDone={onToggleDone}
          onDataChange={onDataChange}
        />
        <PrioritySection
          priority="low"
          tasks={lowTasks}
          allTasks={allTasks}
          date={date}
          onToggleDone={onToggleDone}
          onDataChange={onDataChange}
        />
      </ScrollView>

      {/* Generate */}
      <View style={styles.footer}>
        {hasSchedule ? (
          <Text style={styles.footerNote}>Schedule generated — ask Jarvis to adjust</Text>
        ) : (
          <TouchableOpacity
            style={[styles.generateButton, (isGenerating || allTasks.length === 0) && styles.generateButtonDisabled]}
            onPress={onGenerate}
            disabled={isGenerating || allTasks.length === 0}
          >
            {isGenerating ? (
              <ActivityIndicator color="#f5f4f0" size="small" />
            ) : (
              <Text style={styles.generateText}>✨ Generate Schedule</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f4f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e3df',
  },
  brand: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f0e0c',
    letterSpacing: -0.5,
  },
  progress: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e5e3df',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    color: '#0f0e0c',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#a8a29e',
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 11,
    color: '#a8a29e',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d4d0cb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0f0e0c',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#a8a29e',
  },
  taskMeta: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 2,
  },
  taskActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionIcon: {
    fontSize: 16,
    padding: 4,
  },
  deleteConfirm: {
    opacity: 0.5,
  },
  editCard: {
    backgroundColor: '#ebebе7',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginVertical: 4,
  },
  editInput: {
    backgroundColor: '#f5f4f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f0e0c',
    borderWidth: 1,
    borderColor: '#e5e3df',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#0f0e0c',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#f5f4f0',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e3df',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#0f0e0c',
    fontSize: 14,
  },
  addButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  addButtonText: {
    fontSize: 14,
    color: '#a8a29e',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e3df',
  },
  generateButton: {
    backgroundColor: '#0f0e0c',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  generateText: {
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '600',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 13,
    color: '#a8a29e',
    paddingVertical: 12,
  },
})
