import { getSections, getLogs, latestCoachNote, getCourseSummary } from '@/lib/db/queries';
import {
  computePace, streak, coreSections, finishedSectionIds,
  buildDynamicSchedule, currentWeek, buildCurriculumRows, planTimeline, planBreakFor,
} from '@/lib/schedule';
import { ACTIVE_COURSE, COURSE_IDS, getCourse, courseStage } from '@/lib/courses';
import { TIME_ZONE } from '@/lib/config';
import { todayInTZ, diffDays } from '@/lib/date';
import { fmtDate, sectionTag } from '@/lib/format';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProgressRing } from '@/components/progress-ring';
import { StreakBadge } from '@/components/streak-badge';
import { CoachNoteCard } from '@/components/student/coach-note-card';
import { StuckButton } from '@/components/student/stuck-button';
import { JourneyStats } from '@/components/student/journey-stats';
import { Roadmap } from '@/components/student/roadmap';
import { StudySessions } from '@/components/student/study-sessions';
import { ManualCheckIn } from '@/components/student/manual-check-in';
import { CompletedCourseBadge } from '@/components/student/completed-course-badge';
import { BreakCard } from '@/components/student/break-card';
import { Heatmap } from '@/components/coach/heatmap';
import { Motivations } from '@/components/student/motivations';

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

// Mansi's view of the ACTIVE course (React). Finished courses (JS) shrink to a badge.
// Player sessions appear in "Your study sessions" on their own; the manual check-in
// is a collapsed fallback.
export default async function StudentPage() {
  const today = todayInTZ(TIME_ZONE);
  const course = getCourse(ACTIVE_COURSE);
  const plan = course.plan;
  const finishedCourses = COURSE_IDS.map(getCourse).filter((c) => c.status === 'completed');
  const [sections, logs, note, summaries] = await Promise.all([
    getSections(course.id), getLogs(course.id), latestCoachNote(),
    Promise.all(finishedCourses.map((c) => getCourseSummary(c.id))),
  ]);
  const pace = computePace({ today, sections, logs, config: plan });
  const days = streak(logs, today, plan);

  const core = coreSections(sections);
  const doneIds = finishedSectionIds(logs);
  const sectionsDone = core.filter((s) => doneIds.has(s.id)).length;

  const timeline = planTimeline(sections, plan);
  const week = Math.max(1, currentWeek(today, plan)); // clamp so pre-start shows week 1 context
  const dyn = buildDynamicSchedule(sections, logs, plan, today);
  const cur = dyn.currentSection;
  const stage = courseStage(course.id, week, cur);
  const daysToDeadline = diffDays(today, timeline.deadline);
  const subline = SUBLINES[Math.abs(diffDays('2026-01-01', today)) % SUBLINES.length];
  const name = process.env.STUDENT_NAME ?? 'there';
  const coachName = process.env.COACH_NAME ?? 'your coach';
  const rows = buildCurriculumRows(sections, logs, dyn, today);
  // a plan break in progress or within 14 days (Diwali) — the same one the Course Player shows
  const planBreak = planBreakFor(today, plan.breaks);
  const onBreak = planBreak !== null && today >= planBreak.start;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      <div className="mb-6 flex justify-end">
        <ThemeToggle />
      </div>

      <header className="reveal">
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm text-faint">{greeting(TIME_ZONE)}, {name} 👋</p>
          {finishedCourses.map((c, i) => (
            <CompletedCourseBadge key={c.id} shortTitle={c.shortTitle} title={c.title} summary={summaries[i]} />
          ))}
        </div>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-ink">Today&apos;s focus</h1>
        <p className="mt-1 text-lg text-accent-deep">
          {cur ? `${sectionTag(cur.sortOrder)} · ${cur.title}` : `${course.shortTitle} complete — you did it! 🎉`}
        </p>
        <p className="mt-2 max-w-xl text-muted">{subline}</p>
      </header>

      {planBreak && (
        <div className="mt-6">
          <BreakCard planBreak={planBreak} breaks={plan.breaks} today={today} />
        </div>
      )}

      {note && (
        <div className="mt-6">
          <CoachNoteCard note={note} coachName={coachName} />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        {/* left — what she did (automatic), then the manual fallback */}
        <div className="space-y-6 reveal lg:col-span-7">
          <StudySessions logs={logs} sections={sections} today={today} startDate={plan.startDate} notStarted={pace.notStarted} />
          <ManualCheckIn sections={sections} currentSectionId={cur?.id ?? null} finishedIds={[...doneIds]} />
          <StuckButton sectionId={cur?.id ?? null} />
        </div>

        {/* right — encouragement + context */}
        <div className="space-y-6 reveal lg:col-span-5">
          <div className="flex items-center gap-5 rounded-2xl border border-hair bg-surface p-5 shadow">
            <ProgressRing pct={pace.contentPct} label={`of ${course.shortTitle}`} />
            <div className="space-y-2">
              <StreakBadge days={days} />
              <p className="text-sm text-muted">
                {pace.notStarted
                  ? `Your ${course.shortTitle} journey starts ${fmtDate(plan.startDate)} — feel free to look around!`
                  : onBreak ? `${planBreak.label} break — your plan is paused, nothing is slipping. 💚` : PACE_COPY[pace.status]}
              </p>
            </div>
          </div>
          <JourneyStats
            sectionsDone={sectionsDone}
            totalSections={core.length}
            effortMinutes={pace.effortMinutes}
            stage={stage}
            dyn={dyn}
            daysToDeadline={daysToDeadline}
            notStarted={pace.notStarted}
            onBreak={onBreak}
            plan={{ dailyHours: plan.dailyHours, studyDaysPerWeek: plan.studyDaysPerWeek, target: timeline.target, deadline: timeline.deadline, breaks: plan.breaks }}
          />
        </div>
      </div>

      {/* your study streak */}
      <div className="mt-8">
        <Heatmap logs={logs} startDate={plan.startDate} planEnd={timeline.deadline} breaks={plan.breaks} today={today} streakDays={days} center={<Motivations />} />
      </div>

      {/* your roadmap */}
      <div className="mt-8">
        <Roadmap rows={rows} currentSectionId={cur?.id ?? null} />
      </div>
    </main>
  );
}
