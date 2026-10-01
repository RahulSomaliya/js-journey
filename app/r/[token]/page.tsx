import { getSections, getLogs, openStuckFlags } from '@/lib/db/queries';
import {
  computePace, buildDynamicSchedule, currentWeek, buildCurriculumRows, streak, planTimeline, finishedEffortRatio,
  planBreakFor, timelineElapsedPct,
} from '@/lib/schedule';
import { LESSONS, playerLessons } from '@/lib/lessons';
import { ACTIVE_COURSE, getCourse, isCourseId, courseStage } from '@/lib/courses';
import { TIME_ZONE } from '@/lib/config';
import { todayInTZ } from '@/lib/date';
import { fmtDate } from '@/lib/format';
import { ThemeToggle } from '@/components/theme-toggle';
import { CourseSwitcher } from '@/components/coach/course-switcher';
import { StatusHeadline } from '@/components/coach/status-headline';
import { PaceCard } from '@/components/coach/pace-card';
import { ThisWeek } from '@/components/coach/this-week';
import { Heatmap } from '@/components/coach/heatmap';
import { SessionsFeed } from '@/components/coach/sessions-feed';
import { Curriculum } from '@/components/coach/curriculum';
import { LatestFromMansi } from '@/components/coach/latest-from-mansi';
import { StuckList } from '@/components/coach/stuck-list';
import { SendNoteForm } from '@/components/coach/send-note-form';
import { PlanBreakNotice } from '@/components/coach/plan-break-notice';

export const dynamic = 'force-dynamic';

// The honest dashboard for ONE course: the active one (React) by default, a finished
// one as history via ?course=js. Every number below is computed from that course's
// sections + logs + plan only.
export default async function CoachPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const requested = (await searchParams).course;
  const courseId = isCourseId(requested) ? requested : ACTIVE_COURSE;
  const course = getCourse(courseId);
  const plan = course.plan;
  const today = todayInTZ(TIME_ZONE);
  const [sections, logs, stuck] = await Promise.all([getSections(courseId), getLogs(courseId), openStuckFlags()]);
  const pace = computePace({ today, sections, logs, config: plan });
  const dyn = buildDynamicSchedule(sections, logs, plan, today);
  const { target, deadline } = planTimeline(sections, plan);
  const week = currentWeek(today, plan);
  const rows = buildCurriculumRows(sections, logs, dyn, today);
  const curId = dyn.currentSection?.id ?? null;
  const latest = logs[0] ?? null;
  const latestTitle = latest ? (sections.find((s) => s.id === latest.sectionId)?.title ?? 'Review') : '';
  const streakDays = streak(logs, today, plan);
  // share of the plan's STUDY days elapsed from start → deadline (pauses over a break)
  const timelinePct = timelineElapsedPct(today, plan, deadline);
  const planBreak = planBreakFor(today, plan.breaks);
  // JS has a hand-made Udemy outline; React's per-section list comes from the player
  const lessons = courseId === 'js' ? LESSONS : playerLessons(courseId, logs);

  return (
    <main className="mx-auto max-w-[1680px] px-4 py-10 sm:px-10">
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 pr-14">
        <span className="text-sm font-medium text-faint">Mansi&rsquo;s Journey</span>
        <CourseSwitcher current={courseId} />
        <ThemeToggle />
      </div>

      {course.status === 'completed' && (
        <div className="mb-6 rounded-xl border border-hair bg-surface-2 px-5 py-3 text-sm text-muted">
          <span className="font-medium text-ink">{course.title}</span> — finished course, shown as history
          (plan {fmtDate(plan.startDate)} → target {fmtDate(target)}, deadline {fmtDate(deadline)}).
        </div>
      )}

      {/* Verdict */}
      <header className="reveal">
        <StatusHeadline pace={pace} startDate={plan.startDate} />
      </header>
      {planBreak && (
        <div className="mt-5">
          <PlanBreakNotice planBreak={planBreak} breaks={plan.breaks} today={today} />
        </div>
      )}
      {stuck.length > 0 && (
        <div className="mt-5">
          <StuckList items={stuck} />
        </div>
      )}

      {/* Latest from Mansi + reply */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <LatestFromMansi log={latest} sectionTitle={latestTitle} />
        </div>
        <div className="lg:col-span-4">
          <SendNoteForm />
        </div>
      </div>

      {/* Pace + this week */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <PaceCard pace={pace} target={target} deadline={deadline} timelinePct={timelinePct} plan={plan} effortRatio={finishedEffortRatio(sections, logs)} />
        </div>
        <div className="lg:col-span-4">
          <ThisWeek week={week} dyn={dyn} logs={logs} multiplier={plan.multiplier} stage={courseStage(courseId, week, dyn.currentSection)} />
        </div>
      </div>

      {/* Contribution graph */}
      <div className="mt-6">
        <Heatmap logs={logs} startDate={plan.startDate} planEnd={deadline} breaks={plan.breaks} today={today} streakDays={streakDays} />
      </div>

      {/* Every session, with source + lectures */}
      <div className="mt-6">
        <SessionsFeed logs={logs} sections={sections} />
      </div>

      {/* Full curriculum */}
      <div className="mt-6">
        <Curriculum
          rows={rows}
          lessons={lessons}
          currentSectionId={curId}
          emptyText={courseId === 'js' ? undefined : 'No lectures completed in the Course Player yet.'}
        />
      </div>
    </main>
  );
}
