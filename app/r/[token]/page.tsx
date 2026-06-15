import { getSections, getLogs, openStuckFlags } from '@/lib/db/queries';
import { computePace, buildMilestones, totalWeeks, currentWeek } from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { todayInTZ, fridayOfWeek } from '@/lib/date';
import { ThemeToggle } from '@/components/theme-toggle';
import { StatusHeadline } from '@/components/coach/status-headline';
import { PaceCard } from '@/components/coach/pace-card';
import { ThisWeek } from '@/components/coach/this-week';
import { Heatmap } from '@/components/coach/heatmap';
import { LogsFeed } from '@/components/coach/logs-feed';
import { ScheduleTable } from '@/components/coach/schedule-table';
import { StuckList } from '@/components/coach/stuck-list';
import { SendNoteForm } from '@/components/coach/send-note-form';

export const dynamic = 'force-dynamic';

export default async function CoachPage() {
  const today = todayInTZ(PLAN.timeZone);
  const [sections, logs, stuck] = await Promise.all([getSections(), getLogs(), openStuckFlags()]);
  const pace = computePace({ today, sections, logs, config: PLAN });
  const milestones = buildMilestones(sections, PLAN);
  const weeks = totalWeeks(sections, PLAN);
  const target = fridayOfWeek(PLAN.startDate, weeks); // 25 Sep 2026 — core complete
  const deadline = fridayOfWeek(PLAN.startDate, weeks + PLAN.graceWeeks); // 2 Oct 2026 — official deadline
  const week = currentWeek(today, PLAN);
  const thisWeekMilestone = milestones.find((m) => m.week === week) ?? null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 space-y-6">
      <ThemeToggle />
      <header className="reveal"><StatusHeadline pace={pace} /></header>
      <StuckList items={stuck} />
      <PaceCard pace={pace} target={target} deadline={deadline} />
      <ThisWeek week={week} milestone={thisWeekMilestone} sections={sections} logs={logs} />
      <Heatmap logs={logs} startDate={PLAN.startDate} weeks={weeks} />
      <div className="grid gap-6 md:grid-cols-2">
        <LogsFeed logs={logs} sections={sections} />
        <SendNoteForm />
      </div>
      <ScheduleTable milestones={milestones} logs={logs} sections={sections} today={today} />
    </main>
  );
}
