export default function ChatPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-gray-800">Jarvis</h2>
        <p className="text-xs text-gray-400">AI assistant — coming soon</p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-300 space-y-2">
          <div className="text-4xl">🤖</div>
          <p className="text-sm">Chat coming in Milestone 6</p>
        </div>
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            disabled
            placeholder="Talk to Jarvis..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
          />
          <button
            disabled
            className="bg-violet-600 text-white rounded-lg px-4 py-2 text-sm opacity-40 cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}