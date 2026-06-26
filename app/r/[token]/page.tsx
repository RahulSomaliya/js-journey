import { getSections, getLogs, openStuckFlags } from '@/lib/db/queries';
import { computePace, buildMilestones, totalWeeks, currentWeek, currentSection, buildCurriculumRows, streak } from '@/lib/schedule';
import { LESSONS } from '@/lib/lessons';
import { PLAN } from '@/lib/config';
import { todayInTZ, fridayOfWeek, diffDays } from '@/lib/date';
import { ThemeToggle } from '@/components/theme-toggle';
import { StatusHeadline } from '@/components/coach/status-headline';
import { PaceCard } from '@/components/coach/pace-card';
import { ThisWeek } from '@/components/coach/this-week';
import { Heatmap } from '@/components/coach/heatmap';
import { LogsFeed } from '@/components/coach/logs-feed';
import { Curriculum } from '@/components/coach/curriculum';
import { LatestFromMansi } from '@/components/coach/latest-from-mansi';
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
  const latest = logs[0] ?? null;
  const latestTitle = latest ? (sections.find((s) => s.id === latest.sectionId)?.title ?? 'Review') : '';
  const streakDays = streak(logs, today, PLAN);
  // share of the calendar elapsed from start → deadline
  const elapsed = diffDays(PLAN.startDate, today);
  const span = diffDays(PLAN.startDate, deadline);
  const timelinePct = Math.min(100, Math.max(0, Math.round((elapsed / span) * 100)));

  return (
    <main className="mx-auto max-w-[1680px] px-10 py-10">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-sm font-medium text-faint">Mansi&rsquo;s JS Journey</span>
        <ThemeToggle />
      </div>

      {/* Verdict */}
      <header className="reveal">
        <StatusHeadline pace={pace} />
      </header>
      {stuck.length > 0 && (
        <div className="mt-5">
          <StuckList items={stuck} />
        </div>
      )}

      {/* Latest from Mansi + reply */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <LatestFromMansi log={latest} sectionTitle={latestTitle} />
        </div>
        <div className="col-span-4">
          <SendNoteForm />
        </div>
      </div>

      {/* Pace + this week */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <PaceCard pace={pace} target={target} deadline={deadline} timelinePct={timelinePct} />
        </div>
        <div className="col-span-4">
          <ThisWeek week={week} milestone={thisWeekMilestone} sections={sections} logs={logs} />
        </div>
      </div>

      {/* Contribution graph */}
      <div className="mt-6">
        <Heatmap logs={logs} startDate={PLAN.startDate} weeks={weeks} today={today} streakDays={streakDays} />
      </div>

      {/* Full curriculum */}
      <div className="mt-6">
        <Curriculum rows={rows} lessons={LESSONS} currentSectionId={curId} />
      </div>

      {/* Recent logs history */}
      <div className="mt-6">
        <LogsFeed logs={logs} sections={sections} />
      </div>
    </main>
  );
}
