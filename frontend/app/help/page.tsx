import HelpClient from "./HelpClient";

export default function HelpPage() {
  return (
    <div className="font-dm min-h-screen bg-[#f5f4f0] dark:bg-[#0c0c0b] text-[#0f0e0c] dark:text-[#f0ede8]">
      <main className="w-full px-5 py-12 md:px-8 lg:px-12">
        <div className="max-w-5xl mx-auto mb-12">
          <p className="font-syne text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400 dark:text-stone-600 mb-3">
            DAYFORGE • JARVIS
          </p>
          <h1 className="font-syne text-[clamp(36px,7vw,64px)] font-black tracking-tighter leading-none mb-4">
            What can Jarvis do?
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400 max-w-lg">
            Your AI productivity companion. Speak naturally — Jarvis handles planning, reflection, and growth.
          </p>
        </div>

        <HelpClient />
      </main>
    </div>
  );
}