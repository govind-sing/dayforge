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
  if (!d) return "No deadline";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AlignmentBadge({ score }: { score: number | null }) {
  if (score === null) return (
    <span className="text-xs text-gray-400 italic">No data yet</span>
  );

  const label = score >= 80 ? "improving" : score >= 50 ? "consistent" : "drifting";
  const color =
    score >= 80 ? "text-green-600 bg-green-50 border-green-200" :
    score >= 50 ? "text-yellow-600 bg-yellow-50 border-yellow-200" :
    "text-red-500 bg-red-50 border-red-200";

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
        {label}
      </span>
      <span className="text-sm font-semibold text-gray-700">{score}%</span>
    </div>
  );
}

function PersonalitySection({ context }: { context: string | null }) {
  if (!context) return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <p className="text-sm font-medium text-gray-700 mb-1">Personality insights</p>
      <p className="text-xs text-gray-400">
        Complete your first EOD reflection to see insights about how you work.
      </p>
    </div>
  );

  // Parse lines — skip the header line "PERSONALITY INSIGHTS (past 30 days):"
  const lines = context
    .split("\n")
    .filter(l => l.trim() && !l.startsWith("PERSONALITY INSIGHTS"));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <p className="text-sm font-medium text-gray-700 mb-4">How you work</p>
      <ul className="space-y-3">
        {lines.map((line, i) => {
          const [label, ...rest] = line.split(":");
          const value = rest.join(":").trim();
          return (
            <li key={i} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {label.trim()}
              </span>
              <span className="text-sm text-gray-700">{value}</span>
            </li>
          );
        })}
      </ul>
    </div>
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
    getProfile().then((p) => {
      setProfile(p);
      setWorkStart(formatTime(p.work_start));
      setWorkEnd(formatTime(p.work_end));
    }).catch(() => setError("Failed to load profile."));
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
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 max-w-xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-gray-400 hover:text-gray-600 inline-flex items-center gap-1"
        >
          ← Dashboard
        </button>
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push("/");
          }}
          className="text-sm text-red-400 hover:text-red-600 transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Name */}
      <div className="mb-10">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">You</p>
        <h1 className="text-2xl font-semibold text-gray-900">
          {profile.display_name ?? profile.email}
        </h1>
        <p className="text-sm text-gray-400 mt-1">{profile.email}</p>
      </div>

      {/* Personality insights */}
      <PersonalitySection context={profile.personality_context} />

      {/* Work hours */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-4">Work hours</p>
        <div className="flex gap-4 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Start</label>
            <input
              type="time"
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">End</label>
            <input
              type="time"
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      </div>

      {/* Goals */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-700">Goals</p>
          <span className="text-xs text-gray-400">Managed by Jarvis</span>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Ask Jarvis to add or update goals. Deadlines can only be extended with a good reason.
        </p>

        {profile.goals.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No goals yet. Tell Jarvis what you&apos;re working toward.
          </p>
        ) : (
          <ul className="space-y-4">
            {profile.goals.map((goal) => (
              <li
                key={goal.id}
                className="py-4 border-t border-gray-100 first:border-t-0"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{goal.title}</p>
                    {goal.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{goal.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
                    {formatDeadline(goal.deadline)}
                  </span>
                </div>

                {/* Commitment */}
                {goal.committed_days?.length > 0 && (
                  <p className="text-xs text-gray-400 mb-2">
                    {goal.committed_days.join(", ")} — {goal.committed_hours}hr/day
                  </p>
                )}

                {/* Alignment score */}
                <AlignmentBadge score={goal.alignment_score} />

                {goal.alignment_updated_at && (
                  <p className="text-xs text-gray-300 mt-1">
                    Updated {new Date(goal.alignment_updated_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short"
                    })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}