import { View, StyleSheet, TouchableOpacity, Text } from 'react-native'
import { Calendar } from 'react-native-big-calendar'
import { ScheduleResponse, TaskFormData } from '../lib/api'

interface Props {
  date: string
  schedule: ScheduleResponse | null
  highTasks: TaskFormData[]
  mediumTasks: TaskFormData[]
  lowTasks: TaskFormData[]
  onToggleDone: (taskId: string, isDone: boolean) => void
  onDateChange: (date: string) => void
  onGenerate: () => void
  isGenerating: boolean
}

const priorityColors: Record<string, string> = {
  high: '#f87171',
  medium: '#fbbf24',
  low: '#4ade80',
}

export default function CalendarView({
  date,
  schedule,
  onToggleDone,
  onDateChange,
  onGenerate,
  isGenerating,
}: Props) {
  const events = (schedule?.scheduled ?? []).map(item => ({
    title: item.title,
    start: new Date(`${date}T${item.start_time}:00`),
    end: new Date(`${date}T${item.end_time}:00`),
    color: item.is_done ? '#9ca3af' : (priorityColors[item.priority] ?? '#a78bfa'),
    taskId: item.task_id,
    isDone: item.is_done ?? false,
  }))

  const goToday = () => onDateChange(new Date().toISOString().split('T')[0])

  const handleEventPress = (event: typeof events[0]) => {
    onToggleDone(event.taskId, !event.isDone)
  }

  return (
    <View style={styles.container}>
      {/* Calendar Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => {
            const d = new Date(date)
            d.setDate(d.getDate() - 1)
            onDateChange(d.toISOString().split('T')[0])
          }}
        >
          <Text style={styles.navText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={goToday}>
          <Text style={styles.todayButton}>Today</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => {
            const d = new Date(date)
            d.setDate(d.getDate() + 1)
            onDateChange(d.toISOString().split('T')[0])
          }}
        >
          <Text style={styles.navText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar */}
      <View style={styles.calendarContainer}>
        <Calendar
          events={events}
          height={600}
          mode="day"
          date={new Date(date)}
          onPressEvent={handleEventPress}
          eventCellStyle={event => ({
            backgroundColor: (event as any).color,
            borderRadius: 8,
          })}
          scrollOffsetMinutes={360}
        />
      </View>

      {/* Generate Button */}
      {!schedule && (
        <TouchableOpacity
          style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
          onPress={onGenerate}
          disabled={isGenerating}
        >
          <Text style={styles.generateText}>
            {isGenerating ? 'Generating...' : '✨ Generate Schedule'}
          </Text>
        </TouchableOpacity>
      )}

      {schedule && (
        <View style={styles.scheduleNote}>
          <Text style={styles.scheduleNoteText}>Schedule generated — ask Jarvis to adjust</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f4f0',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#ebebе7',
  },
  navText: {
    fontSize: 22,
    color: '#0f0e0c',
    fontWeight: '300',
  },
  todayButton: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0f0e0c',
    color: '#f5f4f0',
    borderRadius: 12,
  },
  calendarContainer: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  generateButton: {
    margin: 16,
    backgroundColor: '#0f0e0c',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateText: {
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '600',
  },
  scheduleNote: {
    margin: 16,
    alignItems: 'center',
  },
  scheduleNoteText: {
    fontSize: 13,
    color: '#a8a29e',
  },
})
