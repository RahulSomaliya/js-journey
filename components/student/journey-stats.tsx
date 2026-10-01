import type { DynamicSchedule, PlanBreak } from '@/lib/schedule';
import type { CourseStage } from '@/lib/courses';
import { fmtDur, fmtDate, fmtDateRange, sectionTag } from '@/lib/format';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 text-center">
      <div className="font-serif text-2xl font-semibold text-ink">{value}</div>
      <div className="text-[0.7rem] uppercase tracking-wider text-faint">{label}</div>
    </div>
  );
}

const days = (n: number) => `${n} study day${n === 1 ? '' : 's'}`;

export function JourneyStats({
  sectionsDone, totalSections, effortMinutes, stage, dyn, daysToDeadline, notStarted, onBreak, plan,
}: {
  sectionsDone: number; totalSections: number; effortMinutes: number;
  stage: CourseStage | null; dyn: DynamicSchedule; daysToDeadline: number; notStarted: boolean;
  /** a plan break is in progress: the checkpoint reads "when you're back", never "catch up" */
  onBreak: boolean;
  plan: { dailyHours: number; studyDaysPerWeek: number; target: string; deadline: string; breaks: readonly PlanBreak[] };
}) {
  // study days (Mon–Fri outside plan breaks) — the same number the Course Player shows (JourneyStatus.daysDelta)
  const d = dyn.studyDaysDelta;
  const buffer = notStarted
    ? { text: d > 0 ? `Your plan has ${days(d)} of breathing room built in. 💚` : 'Your plan starts fresh. 💚', cls: 'text-muted' }
    : d > 0
      ? { text: `🎉 You're ${days(d)} ahead — keep banking time!`, cls: 'text-accent' }
      : d < 0
        ? { text: `You're ${days(-d)} behind — one good session brings it back. 💚`, cls: 'text-warn' }
        : { text: 'Right on schedule. 💚', cls: 'text-muted' };
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Your journey</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Tile label="sections" value={`${sectionsDone}/${totalSections}`} />
        <Tile label="invested" value={fmtDur(effortMinutes)} />
        <Tile label="days left" value={String(Math.max(0, daysToDeadline))} />
      </div>
      {stage && <p className="mt-3 text-sm text-muted">You&apos;re in <span className="font-medium text-ink">{stage.label} {stage.n}: {stage.name}</span>.</p>}
      {dyn.currentSection ? (
        <p className="mt-1 text-sm text-muted">
          {onBreak ? 'When you’re back: finish ' : dyn.isCurrentOverdue ? 'Catch up: finish ' : 'Next checkpoint: finish '}
          <span className="font-medium text-ink">{sectionTag(dyn.currentSection.sortOrder)} {dyn.currentSection.title}</span>
          {dyn.currentDueDate ? <> by <span className="font-medium text-ink">{fmtDate(dyn.currentDueDate)}</span></> : null}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-accent">Course complete — you did it! 🎉</p>
      )}
      <p className="mt-1 text-sm text-muted">On this pace you&apos;ll finish by <span className="font-medium text-ink">{fmtDate(dyn.projectedFinishDate)}</span>.</p>
      <p className={`mt-2 text-sm font-medium ${buffer.cls}`}>{buffer.text}</p>
      <p className="mt-3 border-t border-hair pt-3 text-xs leading-relaxed text-faint">
        The plan: {plan.dailyHours} h a day, {plan.studyDaysPerWeek} days a week
        {plan.breaks.map((b) => `, with a ${b.label} break (${fmtDateRange(b.start, b.end)})`).join('')}
        {' '}— course done by {fmtDate(plan.target)}, deadline {fmtDate(plan.deadline)}.
      </p>
    </div>
  );
}
