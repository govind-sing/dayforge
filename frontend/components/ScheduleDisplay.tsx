import { ScheduleResponse } from "@/types/schedule"


const priorityColor = {
  high: "border-red-400 bg-red-50",
  medium: "border-yellow-400 bg-yellow-50",
  low: "border-green-400 bg-green-50",
}

const priorityBadge = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
}

export default function ScheduleDisplay({ schedule }: { schedule: ScheduleResponse }) {
  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">
          Today&apos;s Schedule
        </h2>
        <span className="text-sm text-gray-500">{schedule.plan_date}</span>
      </div>

      {/* Summary */}
      <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-800">
        {schedule.summary}
      </div>

      {/* Scheduled tasks */}
      <div className="space-y-3">
        {schedule.scheduled.map((item) => (
          <div
            key={item.task_id}
            className={`border-l-4 rounded-lg p-4 ${priorityColor[item.priority]}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">{item.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge[item.priority]}`}>
                    {item.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-500 italic">{item.reasoning}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-medium text-gray-700">
                  {item.start_time} – {item.end_time}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Skipped tasks */}
      {schedule.skipped.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Skipped
          </h3>
          {schedule.skipped.map((item) => (
            <div
              key={item.task_id}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex items-center justify-between"
            >
              <span className="text-sm text-gray-500 line-through">{item.title}</span>
              <span className="text-xs text-gray-400">{item.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}