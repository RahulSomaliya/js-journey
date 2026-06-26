import { getSections, getLogs, openStuckFlags } from '@/lib/db/queries';
import { computePace, buildMilestones, totalWeeks, currentWeek, currentSection, buildCurriculumRows } from '@/lib/schedule';
import { LESSONS } from '@/lib/lessons';
import { PLAN } from '@/lib/config';
import { todayInTZ, fridayOfWeek } from '@/lib/date';
import { ThemeToggle } from '@/components/theme-toggle';
import { StatusHeadline } from '@/components/coach/status-headline';
import { PaceCard } from '@/components/coach/pace-card';
import { ThisWeek } from '@/components/coach/this-week';
import { Heatmap } from '@/components/coach/heatmap';
import { LogsFeed } from '@/components/coach/logs-feed';
import { Curriculum } from '@/components/coach/curriculum';
import { StuckList } from '@/components/coach/stuck-list';
import { SendNoteForm } from '@/components/coach/send-note-form';

export const dynamic = 'force-dynamic';

export default async function CoachPage() {
  const today = todayInTZ(PLAN.timeZone);
  const [sections, logs, stuck] = await Promise.all([getSections(), getLogs(), openStuckFlags()]);
  const pace = computePace({ today, sections, logs, config: PLAN });
  const milestones = buildMilestones(sections, PLAN);
  const weeks = totalWeeks(sections, PLAN);
  const target = fridayOfWeek(PLAN.startDate, weeks); // core complete
  const deadline = fridayOfWeek(PLAN.startDate, weeks + PLAN.graceWeeks); // official deadline
  const week = currentWeek(today, PLAN);
  const thisWeekMilestone = milestones.find((m) => m.week === week) ?? null;
  const rows = buildCurriculumRows(sections, logs, milestones, today);
  const curId = currentSection(sections, logs)?.id ?? null;

  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-sm font-medium text-faint">Mansi&rsquo;s JS Journey</span>
        <ThemeToggle />
      </div>

      {/* Zone 1 — Status hero */}
      <header className="reveal space-y-5">
        <StatusHeadline pace={pace} />
        <StuckList items={stuck} />
        <PaceCard pace={pace} target={target} deadline={deadline} />
      </header>

      {/* Zone 2 — Right now */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <ThisWeek week={week} milestone={thisWeekMilestone} sections={sections} logs={logs} />
        <Heatmap logs={logs} startDate={PLAN.startDate} weeks={weeks} today={today} />
      </div>

      {/* Zone 3 — Full curriculum */}
      <div className="mt-8">
        <Curriculum rows={rows} lessons={LESSONS} currentSectionId={curId} />
      </div>

      {/* Zone 4 — Activity */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <LogsFeed logs={logs} sections={sections} />
        <SendNoteForm />
      </div>
    </main>
  );
}
