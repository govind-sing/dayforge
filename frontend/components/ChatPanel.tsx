"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "assistant";
  content: string;
  id: string;
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
      content: "Hey! I'm Jarvis. How can I help you stay on track today?",
      id: "welcome",
    },
  ]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<NodeJS.Timeout | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const onDataChangeRef = useRef(onDataChange);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  // WebSocket
  useEffect(() => {
    let ws: WebSocket;
    const connect = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;
      const today = new Date().toISOString().split("T")[0];
      const url = `${process.env.NEXT_PUBLIC_AI_URL!
        .replace("https", "wss")
        .replace("http", "ws")}/api/ai/ws/checkin?token=${token}&plan_date=${today}`;
      ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
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
              return [...prev.slice(0, -1), { role: "assistant", content: data.content, id: Date.now().toString() }];
            }
            return [...prev, { role: "assistant", content: data.content, id: Date.now().toString() }];
          });
        }
        if (data.type === "stream_end") {
          const actions: string[] = data.actions ?? [];
          if (actions.some((a) => MUTATING_ACTIONS.includes(a))) {
            onDataChangeRef.current();
          }
        }
        if (data.type === "error") {
          setTyping(false);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Something went wrong. Try again.", id: Date.now().toString() },
          ]);
        }
      };
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
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
    if (!content.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setMessages((prev) => [...prev, { role: "user", content, id: Date.now().toString() }]);
    setTyping(true);
    wsRef.current.send(JSON.stringify({ type: "user_message", content }));
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        .font-syne { font-family: 'Syne', sans-serif; }
        .font-dm { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div className="font-dm flex flex-col h-full bg-[#f5f4f0] dark:bg-[#0c0c0b] text-[#0f0e0c] dark:text-[#f0ede8]">
        {/* Header */}
        <header className="shrink-0 px-5 py-4 border-b border-stone-200 dark:border-stone-800/60 flex items-center justify-between bg-[#f5f4f0]/80 dark:bg-[#0c0c0b]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-2xl bg-linear-to-br from-stone-800 to-black dark:from-[#f0ede8] dark:to-stone-300 flex items-center justify-center shadow-md">
                <span className="text-[#f5f4f0] dark:text-[#0c0c0b] text-xl font-black tracking-tighter font-syne">J</span>
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#f5f4f0] dark:border-[#0c0c0b] ${connected ? "bg-emerald-500" : "bg-stone-400 dark:bg-stone-600"}`} />
            </div>
            <div>
              <p className="font-syne text-xl tracking-tight font-bold">Jarvis</p>
              <p className="text-[11px] text-stone-400 dark:text-stone-600 -mt-0.5">AI Productivity Assistant</p>
            </div>
          </div>
          <button 
            onClick={() => setMessages([messages[0]])}
            className="text-[13px] text-stone-400 dark:text-stone-600 hover:text-[#0f0e0c] dark:hover:text-[#f0ede8] transition-colors"
          >
            Clear chat
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-8 space-y-8">
          {messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-2xl bg-linear-to-br from-stone-800 to-black dark:from-[#f0ede8] dark:to-stone-300 flex items-center justify-center shrink-0 mt-1 mr-3 shadow">
                  <span className="text-[#f5f4f0] dark:text-[#0c0c0b] text-sm font-black tracking-tighter font-syne">J</span>
                </div>
              )}
              <div
                className={`max-w-[76%] px-5 py-4 text-[15px] leading-relaxed rounded-3xl ${
                  msg.role === "user"
                    ? "bg-[#0f0e0c] dark:bg-[#f0ede8] text-[#f5f4f0] dark:text-[#0c0c0b] rounded-tr-none"
                    : "bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-tl-none shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-stone dark:prose-invert prose-sm max-w-none prose-p:my-0 prose-ul:my-3 prose-ol:my-3 prose-li:my-0 prose-headings:font-semibold font-dm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-line">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start animate-in fade-in">
              <div className="w-8 h-8 rounded-2xl bg-linear-to-br from-stone-800 to-black dark:from-[#f0ede8] dark:to-stone-300 flex items-center justify-center shrink-0 mt-1 mr-3">
                <span className="text-[#f5f4f0] dark:text-[#0c0c0b] text-sm font-black tracking-tighter font-syne">J</span>
              </div>
              <div className="bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 px-5 py-4 rounded-3xl rounded-tl-none shadow-sm">
                <div className="flex gap-1.5">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="w-2 h-2 bg-stone-400 dark:bg-stone-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-6 border-t border-stone-200 dark:border-stone-800/60 bg-[#f5f4f0]/80 dark:bg-[#0c0c0b]/80">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={connected ? "Message Jarvis..." : "Connecting to Jarvis..."}
                  disabled={!connected}
                  rows={1}
                  className="w-full resize-none min-h-14 max-h-50 px-6 py-4
                             bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800
                             focus:border-stone-400 dark:focus:border-stone-600 rounded-3xl 
                             text-[15px] leading-relaxed outline-none font-dm transition-all duration-200
                             text-[#0f0e0c] dark:text-[#f0ede8]"
                />
              </div>
              <button
                onClick={() => sendMessage(input)}
                disabled={!connected || !input.trim()}
                className="w-11 h-11 bg-[#0f0e0c] dark:bg-[#f0ede8] text-[#f5f4f0] dark:text-[#0c0c0b]
                           rounded-2xl flex items-center justify-center disabled:opacity-40
                           hover:opacity-80 active:scale-[0.97] transition-all shrink-0 mb-1"
              >
                <svg width="20" height="20" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 10V2M2 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-stone-400 dark:text-stone-600 mt-3 font-light">
              Enter to send • Shift + Enter for new line
            </p>
          </div>
        </div>
      </div>
    </>
  );
}