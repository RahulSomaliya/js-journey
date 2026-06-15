import { getSections, getLogs, latestCoachNote } from '@/lib/db/queries';
import {
  computePace, currentSection, streak, coreSections, finishedSectionIds,
  buildMilestones, currentWeek, phaseForWeek, totalWeeks,
} from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { todayInTZ, fridayOfWeek, diffDays } from '@/lib/date';
import { fmtDate } from '@/lib/format';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProgressRing } from '@/components/progress-ring';
import { StreakBadge } from '@/components/streak-badge';
import { CheckInForm } from '@/components/student/check-in-form';
import { CoachNoteCard } from '@/components/student/coach-note-card';
import { StuckButton } from '@/components/student/stuck-button';
import { JourneyStats } from '@/components/student/journey-stats';

export const dynamic = 'force-dynamic';

const PACE_COPY: Record<string, string> = {
  ahead: "You're ahead — gorgeous work. ✨",
  on_track: 'Right on track. Keep the rhythm. 💚',
  behind: "A little behind — one good session closes the gap. You've got this.",
};
const SUBLINES = [
  'Small steps, every day — that’s how careers are built.',
  'Two focused hours beat a distracted ten. Let’s go.',
  'Future-you is already grateful for today.',
  'Consistency is the whole secret. Just show up.',
  'Every section you finish is a door that opens.',
];

function greeting(tz: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export default async function StudentPage() {
  const today = todayInTZ(PLAN.timeZone);
  const [sections, logs, note] = await Promise.all([getSections(), getLogs(), latestCoachNote()]);
  const pace = computePace({ today, sections, logs, config: PLAN });
  const cur = currentSection(sections, logs);
  const days = streak(logs, today, PLAN);

  const core = coreSections(sections);
  const doneIds = finishedSectionIds(logs);
  const sectionsDone = core.filter((s) => doneIds.has(s.id)).length;

  const milestones = buildMilestones(sections, PLAN);
  const weeks = totalWeeks(sections, PLAN);
  const week = Math.max(1, currentWeek(today, PLAN)); // clamp so pre-start shows week 1 context
  const milestone = milestones.find((m) => m.week === week) ?? null;
  const phase = phaseForWeek(week);
  const deadline = fridayOfWeek(PLAN.startDate, weeks + PLAN.graceWeeks);
  const daysToDeadline = diffDays(today, deadline);
  const subline = SUBLINES[Math.abs(diffDays('2026-01-01', today)) % SUBLINES.length];
  const name = process.env.STUDENT_NAME ?? 'there';

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      <ThemeToggle />
      <header className="reveal">
        <p className="text-sm text-faint">{greeting(PLAN.timeZone)}, {name} 👋</p>
        <h1 className="mt-1 font-serif text-4xl font-semibold leading-tight text-ink">Today&apos;s focus</h1>
        <p className="mt-1 text-lg text-accent-deep">{cur ? `${cur.id}. ${cur.title}` : 'Course complete — you did it! 🎉'}</p>
        <p className="mt-2 max-w-xl text-muted">{subline}</p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-8">
        {/* left — the action */}
        <div className="space-y-6 reveal">
          <CheckInForm sections={sections} currentSectionId={cur?.id ?? null} />
          <StuckButton sectionId={cur?.id ?? null} />
        </div>

        {/* right — encouragement + context */}
        <div className="space-y-6 reveal">
          <div className="flex items-center gap-5 rounded-2xl border border-hair bg-surface p-5 shadow">
            <ProgressRing pct={pace.contentPct} label="of course" />
            <div className="space-y-2">
              <StreakBadge days={days} />
              <p className="text-sm text-muted">
                {pace.notStarted ? `Your journey starts ${fmtDate(PLAN.startDate)} — feel free to look around!` : PACE_COPY[pace.status]}
              </p>
            </div>
          </div>
          <JourneyStats
            sectionsDone={sectionsDone}
            totalSections={core.length}
            effortMinutes={pace.effortMinutes}
            phase={phase}
            milestone={milestone}
            daysToDeadline={daysToDeadline}
          />
          <CoachNoteCard note={note} />
        </div>
      </div>
    </main>
  );
}
