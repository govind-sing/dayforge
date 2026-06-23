import HelpClient from "./HelpClient"
export default function HelpPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-400 mb-2">
          DayForge · Jarvis guide
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          What can Jarvis do?
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed max-w-lg">
          Jarvis is your AI planning companion. Talk to it like a person — it
          handles tasks, schedules, goals, and reflects your patterns back to you.
        </p>
      </div>

      <HelpClient />
    </main>
  )
}