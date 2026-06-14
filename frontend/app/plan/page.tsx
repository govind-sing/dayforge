'use client'

import { useState, useEffect } from 'react'
import PriorityBlockForm from '@/components/PriorityBlockForm'
import { TaskFormData } from '@/components/TaskRow'
import BlockedSlotsForm, { BlockedSlotFormData } from '@/components/BlockedSlotsForm'
import LogoutButton from '@/components/LogoutButton'
import { apiGet, apiPost } from '@/lib/api'

const emptyTask = (priority: 'high' | 'medium' | 'low'): TaskFormData => ({
  title: '', description: '', estimated_minutes: 30, priority
})

export default function PlanPage() {
  const [highTasks, setHighTasks] = useState<TaskFormData[]>([emptyTask('high')])
  const [mediumTasks, setMediumTasks] = useState<TaskFormData[]>([emptyTask('medium')])
  const [lowTasks, setLowTasks] = useState<TaskFormData[]>([emptyTask('low')])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlotFormData[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading')

  const today = new Date().toISOString().split('T')[0]

  // Load existing plan on mount
  useEffect(() => {
    async function loadPlan() {
      try {
        const result = await apiGet<{ plan_date: string; tasks: TaskFormData[] }>(
          `/api/tasks/daily-plan?plan_date=${today}`
        )

        const high = result.tasks.filter(t => t.priority === 'high')
        const medium = result.tasks.filter(t => t.priority === 'medium')
        const low = result.tasks.filter(t => t.priority === 'low')

        setHighTasks(high.length > 0 ? high : [emptyTask('high')])
        setMediumTasks(medium.length > 0 ? medium : [emptyTask('medium')])
        setLowTasks(low.length > 0 ? low : [emptyTask('low')])

        const slots = await apiGet<BlockedSlotFormData[]>('/api/blocked-slots')
        setBlockedSlots(slots)

        setStatus('idle')
      } catch (err) {
        console.error(err)
        setStatus('idle') // still let them use the form even if load fails
      }
    }

    loadPlan()
  }, [today])

  const handleSubmit = async () => {
    setStatus('saving')
    try {
      const allTasks = [...highTasks, ...mediumTasks, ...lowTasks]
        .filter(t => t.title.trim() !== '')

      await apiPost('/api/tasks/daily-plan', {
        plan_date: today,
        tasks: allTasks,
      })

      setStatus('saved')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  if (status === 'loading') {
    return <main className="max-w-2xl mx-auto p-6">Loading your plan...</main>
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Plan Your Day</h1>
        <LogoutButton />
      </div>

      <PriorityBlockForm level="high" tasks={highTasks} onChange={setHighTasks} />
      <PriorityBlockForm level="medium" tasks={mediumTasks} onChange={setMediumTasks} />
      <PriorityBlockForm level="low" tasks={lowTasks} onChange={setLowTasks} />

      <BlockedSlotsForm slots={blockedSlots} onChange={setBlockedSlots} />

      <button
        onClick={handleSubmit}
        disabled={status === 'saving'}
        className="bg-black text-white rounded px-4 py-2 w-full"
      >
        {status === 'saving' ? 'Saving...' : 'Save Plan'}
      </button>

      {status === 'saved' && <p className="text-green-600">Saved!</p>}
      {status === 'error' && <p className="text-red-600">Something went wrong — check console.</p>}
    </main>
  )
}