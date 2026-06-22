"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const MUTATING_ACTIONS = [
  "add_task",
  "add_tasks",
  "add_to_schedule",
  "generate_schedule",
  "mark_complete",
  "reschedule",
  "skip",
  "delete_task",
  "move_tasks_to_today",
];

interface Props {
  onDataChange: () => void;
}


export default function ChatPanel({ onDataChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hey! I'm Jarvis. Generate a schedule and I'll help you stay on track.",
    },
  ]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<NodeJS.Timeout | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const onDataChangeRef = useRef(onDataChange)
  useEffect(() => {
  onDataChangeRef.current = onDataChange
}, [onDataChange])


  useEffect(() => {
    let ws: WebSocket;

    const connect = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const token = session.access_token;
      const today = new Date().toISOString().split("T")[0];
      const url = `${process.env.NEXT_PUBLIC_AI_URL!.replace("https", "wss").replace("http", "ws")}/api/ai/ws/checkin?token=${token}&plan_date=${today}`;

      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);

        if (data.type === "connected") return;

        if (data.type === "stream_chunk") {
          setTyping(false);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.content === "...") {
              return [
                ...prev.slice(0, -1),
                { role: "assistant", content: data.content },
              ];
            }
            return [...prev, { role: "assistant", content: data.content }];
          });
        }

        if (data.type === "stream_end") {
          const actions: string[] = data.actions ?? [];
          if (actions.some((a: string) => MUTATING_ACTIONS.includes(a))) {
          onDataChangeRef.current()  // use ref, not the prop directly
        }
        }

        if (data.type === "error") {
          setTyping(false);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Something went wrong. Try again." },
          ]);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (pingRef.current) clearInterval(pingRef.current);
      };

      ws.onerror = () => {
        setConnected(false);
      };
    };

    connect();

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = (content: string) => {
    if (
      !content.trim() ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    )
      return;
    setMessages((prev) => [...prev, { role: "user", content }]);
    setTyping(true);
    wsRef.current.send(JSON.stringify({ type: "user_message", content }));
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <div
          className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-gray-600"}`}
        />
        <span className="text-sm font-medium text-gray-300">Jarvis</span>
        {!connected && (
          <span className="text-xs text-gray-500 ml-auto">Connecting...</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-800 text-gray-100 rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connected ? "Message Jarvis..." : "Connecting..."}
          disabled={!connected}
          className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-2 outline-none placeholder-gray-500 disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!connected || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
