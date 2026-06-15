import { getSections, getLogs, latestCoachNote } from '@/lib/db/queries';
import { computePace, currentSection, streak } from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { todayInTZ } from '@/lib/date';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProgressRing } from '@/components/progress-ring';
import { StreakBadge } from '@/components/streak-badge';
import { CheckInForm } from '@/components/student/check-in-form';
import { CoachNoteCard } from '@/components/student/coach-note-card';
import { StuckButton } from '@/components/student/stuck-button';

export const dynamic = 'force-dynamic';

const PACE_COPY: Record<string, string> = {
  ahead: "You're ahead — gorgeous work. ✨",
  on_track: "You're right on track. Keep the rhythm. 💚",
  behind: "A little behind — one good session closes the gap. You've got this.",
};

export default async function StudentPage() {
  const today = todayInTZ(PLAN.timeZone);
  const [sections, logs, note] = await Promise.all([getSections(), getLogs(), latestCoachNote()]);
  const pace = computePace({ today, sections, logs, config: PLAN });
  const cur = currentSection(sections, logs);
  const days = streak(logs, today, PLAN);

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <ThemeToggle />
      <header className="reveal">
        <p className="text-sm text-faint">Hi {process.env.STUDENT_NAME ?? 'there'} 👋</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-ink">Today&apos;s focus</h1>
        <p className="mt-1 text-lg text-accent-deep">{cur ? `${cur.id}. ${cur.title}` : 'Course complete — incredible! 🎉'}</p>
      </header>

      <section className="mt-6 flex items-center gap-5 reveal">
        <ProgressRing pct={pace.contentPct} label="of course" />
        <div className="space-y-2">
          <StreakBadge days={days} />
          <p className="text-sm text-muted">{PACE_COPY[pace.status]}</p>
        </div>
      </section>

      <section className="mt-6"><CheckInForm sections={sections} currentSectionId={cur?.id ?? null} /></section>
      <section className="mt-6 space-y-4">
        <CoachNoteCard note={note} />
        <StuckButton sectionId={cur?.id ?? null} />
      </section>
    </main>
  );
}
