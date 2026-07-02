import { useState, useEffect, useCallback } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Modal,
  ActivityIndicator,
} from 'react-native'
import { apiGet, getSchedule, apiPatch, generateSchedule, TaskFormData, ScheduleResponse, Profile } from '../lib/api'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import CalendarView from '../components/CalendarView'

export default function DashboardScreen() {
  const [highTasks, setHighTasks] = useState<TaskFormData[]>([])
  const [mediumTasks, setMediumTasks] = useState<TaskFormData[]>([])
  const [lowTasks, setLowTasks] = useState<TaskFormData[]>([])
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (selectedDate: string) => {
    try {
      const result = await apiGet<{ plan_date: string; tasks: TaskFormData[] }>(
        `/api/tasks/daily-plan?plan_date=${selectedDate}`
      )
      const tasks = result.tasks ?? []
      setHighTasks(tasks.filter(t => t.priority === 'high'))
      setMediumTasks(tasks.filter(t => t.priority === 'medium'))
      setLowTasks(tasks.filter(t => t.priority === 'low'))

      const existing = await getSchedule(selectedDate)
      setSchedule(existing)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProfile = useCallback(async () => {
    try {
      const p = await apiGet<Profile>('/api/profile')
      setProfile(p)
    } catch (err) {
      console.error('Failed to load profile:', err)
    }
  }, [])

  useEffect(() => {
    void loadData(date)
    void loadProfile()
  }, [date])

  const handleToggleDone = async (taskId: string, isDone: boolean) => {
    try {
      await apiPatch(`/api/tasks/${taskId}`, { status: isDone ? 'completed' : 'scheduled' })
      const updateTasks = (tasks: TaskFormData[]) =>
        tasks.map(t => t.id === taskId ? { ...t, status: isDone ? 'completed' : 'scheduled' } : t)
      setHighTasks(updateTasks)
      setMediumTasks(updateTasks)
      setLowTasks(updateTasks)
      setSchedule(prev => {
        if (!prev) return prev
        return {
          ...prev,
          scheduled: prev.scheduled.map(item =>
            item.task_id === taskId ? { ...item, is_done: isDone } : item
          ),
        }
      })
    } catch (err) {
      console.error('Failed to toggle task:', err)
    }
  }

  const handleGenerate = async () => {
    const allTasks = [...highTasks, ...mediumTasks, ...lowTasks]
      .filter(t => t.title.trim() !== '' && t.id)
      .filter(t => t.status !== 'completed')
    if (allTasks.length === 0 || !profile) return
    setIsGenerating(true)
    try {
      const now = new Date()
      const isToday = date === now.toISOString().split('T')[0]
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const effectiveStart = isToday
        ? currentTime > (profile.work_start || '06:00') ? currentTime : profile.work_start
        : profile.work_start

      const result = await generateSchedule({
        plan_date: date,
        work_start: effectiveStart,
        work_end: profile.work_end || '22:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        tasks: allTasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description ?? null,
          estimated_minutes: t.estimated_minutes,
          priority: t.priority,
        })),
        blocked_slots: [],
      })
      setSchedule(result)
    } catch (err) {
      console.error('Generate failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDataChange = useCallback(() => void loadData(date), [date, loadData])

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#0f0e0c" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => setSidebarOpen(true)}>
          <Text style={styles.iconText}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>
          {new Date(date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => supabase.auth.signOut()}
        >
          <Text style={styles.iconText}>↪</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar */}
      <CalendarView
        date={date}
        schedule={schedule}
        highTasks={highTasks}
        mediumTasks={mediumTasks}
        lowTasks={lowTasks}
        onToggleDone={handleToggleDone}
        onDateChange={setDate}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />

      {/* Sidebar Drawer */}
      <Modal
        visible={sidebarOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSidebarOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setSidebarOpen(false)} />
          <View style={styles.sidebarContainer}>
            <Sidebar
              date={date}
              highTasks={highTasks}
              mediumTasks={mediumTasks}
              lowTasks={lowTasks}
              hasSchedule={schedule !== null}
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
              onToggleDone={handleToggleDone}
              onClose={() => setSidebarOpen(false)}
              onDataChange={handleDataChange}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f4f0',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f4f0',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e3df',
    backgroundColor: '#f5f4f0',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f0e0c',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#ebebе7',
  },
  iconText: {
    fontSize: 18,
    color: '#0f0e0c',
  },
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sidebarContainer: {
    width: '80%',
    backgroundColor: '#f5f4f0',
  },
})