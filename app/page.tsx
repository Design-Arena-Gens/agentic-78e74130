import DailyShortClient from '@/components/DailyShortClient';
import { getDailyShort } from '@/lib/getDailyShort';

export default function HomePage() {
  const fallback = getDailyShort();

  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-16 lg:px-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#1d2655_0%,#0c1021_60%,#05060d_100%)]" />
      <header className="flex flex-col gap-4 text-left">
        <span className="text-xs uppercase tracking-[0.4em] text-soft/70">WhisperDrop Agent</span>
        <h1 className="max-w-3xl text-5xl font-semibold text-whisper sm:text-6xl">
          Receive a free, hand-picked ASMR short every day at <span className="text-glow">1:00 PM</span>.
        </h1>
        <p className="max-w-2xl text-lg text-soft/80">
          This autonomous agent combs soothing corners of the internet to deliver a satisfying, snackable
          ASMR experience right on schedule. Unlock today&apos;s drop, arm a reminder, and drift.
        </p>
      </header>
      <DailyShortClient fallback={fallback} />
      <footer className="pb-10 text-xs text-soft/50">
        Built to be hosted for free on Vercel. Open the tab shortly before 1:00 PM, or enable
        notifications to receive a gentle nudge when the drop lands.
      </footer>
    </main>
  );
}
