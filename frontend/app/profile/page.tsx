"use client";

import { useState, useEffect } from "react";
import { getProfile, updateProfile } from "@/lib/api";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  created_at: string;
  alignment_score: number | null;
  alignment_updated_at: string | null;
  committed_days: string[];
  committed_hours: number;
}

interface Profile {
  display_name: string | null;
  email: string;
  work_start: string;
  work_end: string;
  personality_context: string | null;
  goals: Goal[];
}

function formatTime(t: string) {
  return t?.slice(0, 5) ?? "";
}

function formatDeadline(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AlignmentBadge({ score }: { score: number | null }) {
  if (score === null)
    return <span className="text-[11px] text-stone-400 dark:text-stone-600 italic">no data yet</span>;

  const label = score >= 80 ? "improving" : score >= 50 ? "consistent" : "drifting";
  const cls =
    score >= 80
      ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
      : score >= 50
      ? "text-amber-500 border-amber-500/20 bg-amber-500/5"
      : "text-rose-500 border-rose-500/20 bg-rose-500/5";
  const dot =
    score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500";

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase px-3 py-1 rounded-full border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label} · {score}%
    </span>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p);
        setWorkStart(formatTime(p.work_start));
        setWorkEnd(formatTime(p.work_end));
      })
      .catch(() => setError("Failed to load profile."));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ work_start: workStart, work_end: workEnd });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f4f0] dark:bg-[#0c0c0b]">
        <div className="flex gap-1.5">
          {[0, 150, 300].map((d) => (
            <span
              key={d}
              className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-700 animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const name = profile.display_name ?? profile.email.split("@")[0];
  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const personalityLines = (profile.personality_context ?? "")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("PERSONALITY INSIGHTS"));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        .font-syne { font-family: 'Syne', sans-serif; }
        .font-dm { font-family: 'DM Sans', sans-serif; }
        input[type="time"]::-webkit-calendar-picker-indicator { opacity: 0.35; }
        @media (prefers-color-scheme: dark) {
          input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.35; }
        }
      `}</style>

      <div className="font-dm min-h-screen w-full bg-[#f5f4f0] dark:bg-[#0c0c0b] text-[#0f0e0c] dark:text-[#f0ede8]">

        {/* ── Nav ── */}
        <nav className="sticky top-0 z-20 w-full h-13 px-5 flex items-center justify-between border-b border-stone-200 dark:border-stone-800/60 bg-[#f5f4f0]/75 dark:bg-[#0c0c0b]/75 backdrop-blur-md">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-[13px] text-stone-400 dark:text-stone-600 hover:text-[#0f0e0c] dark:hover:text-[#f0ede8] transition-colors duration-150 flex items-center gap-1.5"
          >
            ← dashboard
          </button>
          <button
            onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push("/"); }}
            className="text-[13px] text-stone-400 dark:text-stone-600 hover:text-rose-500 transition-colors duration-150"
          >
            sign out
          </button>
        </nav>

        {/* ── Hero ── */}
        <section className="w-full px-5 pt-14 pb-12 border-b border-stone-200 dark:border-stone-800/60 relative overflow-hidden">
          {/* Ghost initials */}
          <div className="font-syne absolute -top-4 -right-2 text-[clamp(96px,22vw,220px)] font-black leading-none text-stone-200 dark:text-stone-800/60 select-none pointer-events-none tracking-tighter">
            {initials}
          </div>

          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400 dark:text-stone-600 mb-4">
              your space
            </p>
            <h1 className="font-syne text-[clamp(40px,10vw,96px)] font-black leading-[0.92] tracking-tight text-[#0f0e0c] dark:text-[#f0ede8] mb-5 warp-break-words">
              {name}
            </h1>
            <p className="text-sm text-stone-400 dark:text-stone-600 italic font-light">
              {profile.email}
            </p>
          </div>
        </section>

        {/* ── Work hours ── */}
        <section className="w-full px-5 py-6 border-b border-stone-200 dark:border-stone-800/60">
          <p className="font-syne text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-600 mb-4">
            Work window
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="time"
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              className="font-dm w-29 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-[#0f0e0c] dark:text-[#f0ede8] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-stone-400 dark:focus:border-stone-600 transition-colors"
            />
            <span className="text-stone-400 dark:text-stone-600 text-sm">→</span>
            <input
              type="time"
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
              className="font-dm w-29 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-[#0f0e0c] dark:text-[#f0ede8] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-stone-400 dark:focus:border-stone-600 transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-40 ${
                saved
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-[#0f0e0c] dark:bg-[#f0ede8] text-[#f5f4f0] dark:text-[#0c0c0b] hover:opacity-80"
              }`}
            >
              {saving ? "saving…" : saved ? "saved ✓" : "save"}
            </button>
          </div>
          {error && <p className="text-xs text-rose-500 mt-3">{error}</p>}
        </section>

        {/* ── Personality ── */}
        {personalityLines.length > 0 && (
          <section className="w-full px-5 py-10 border-b border-stone-200 dark:border-stone-800/60">
            <p className="font-syne text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-600 mb-6">
              How you operate
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5">
              {personalityLines.map((line, i) => {
                const colonIdx = line.indexOf(":");
                const label = colonIdx !== -1 ? line.slice(0, colonIdx).trim() : line;
                const value = colonIdx !== -1 ? line.slice(colonIdx + 1).trim() : "";
                return (
                  <div
                    key={i}
                    className="bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-600 mb-2">
                      {label}
                    </p>
                    <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                      {value}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Goals ── */}
        <section className="w-full px-5 pt-10 pb-20">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="font-syne text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-600">
              Goals
            </p>
            <span className="text-[11px] text-stone-400 dark:text-stone-600 italic">managed by Jarvis</span>
          </div>
          <p className="text-[13px] text-stone-400 dark:text-stone-600 font-light leading-relaxed mb-8">
            Ask Jarvis to add or update goals. Deadlines extend only with a good reason.
          </p>

          {profile.goals.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-600 italic">
              No goals yet. Tell Jarvis what you&apos;re working toward.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {profile.goals.map((goal) => (
                <div
                  key={goal.id}
                  className="bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 rounded-2xl p-5 flex flex-col gap-2.5 transition-colors duration-150"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-syne text-[clamp(16px,3.5vw,20px)] font-bold text-[#0f0e0c] dark:text-[#f0ede8] leading-tight tracking-tight flex-1 min-w-0">
                      {goal.title}
                    </p>
                    <span className="text-[11px] text-stone-400 dark:text-stone-600 whitespace-nowrap mt-0.5 shrink-0 font-light">
                      {formatDeadline(goal.deadline)}
                    </span>
                  </div>

                  {goal.description && (
                    <p className="text-[13px] text-stone-500 dark:text-stone-500 font-light leading-relaxed">
                      {goal.description}
                    </p>
                  )}

                  {goal.committed_days?.length > 0 && (
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-stone-400 dark:text-stone-600">
                      {goal.committed_days.join(" · ")} — {goal.committed_hours}hr/day
                    </p>
                  )}

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <AlignmentBadge score={goal.alignment_score} />
                    {goal.alignment_updated_at && (
                      <p className="text-[11px] text-stone-400 dark:text-stone-600 font-light">
                        updated{" "}
                        {new Date(goal.alignment_updated_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}