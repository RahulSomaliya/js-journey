import type { LogEntry, DynamicSchedule } from '@/lib/schedule';
import { sectionEffortMinutes } from '@/lib/schedule';
import type { CourseStage } from '@/lib/courses';
import { fmtDur, fmtDate, sectionTag } from '@/lib/format';

export function ThisWeek({ week, dyn, logs, multiplier, stage }: {
  week: number; dyn: DynamicSchedule; logs: LogEntry[]; multiplier: number; stage: CourseStage | null;
}) {
  const cur = dyn.currentSection;
  const curEffort = cur ? sectionEffortMinutes(logs, cur.id) : 0;
  const curBudget = cur ? Math.round(cur.videoMinutes * multiplier) : 0;
  // study days (Mon–Fri outside plan breaks) — same number Mansi and the Course Player see
  const d = dyn.studyDaysDelta;
  const deltaLabel =
    d > 0 ? `${d} study day${d === 1 ? '' : 's'} ahead of schedule`
      : d < 0 ? `${-d} study day${d === -1 ? '' : 's'} behind schedule`
        : 'right on schedule';
  const deltaCls = d >= 0 ? 'text-accent' : 'text-warn';
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">This week · Week {week || '—'}</div>
        {stage && <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">{stage.label} {stage.n}: {stage.name}</div>}
      </div>
      {cur ? (
        <div className="mt-3 space-y-1">
          <div className="text-ink">Current: <span className="font-medium">{sectionTag(cur.sortOrder)} {cur.title}</span></div>
          <div className="text-sm text-muted">{fmtDur(curEffort)} spent vs {fmtDur(curBudget)} budgeted for this section ({multiplier}× its video)</div>
          <div className="text-sm text-muted">
            {dyn.isCurrentOverdue ? 'Overdue — aim to finish by ' : 'Target: finish by '}
            <span className="font-medium text-ink">{dyn.currentDueDate ? fmtDate(dyn.currentDueDate) : '—'}</span>
            {' · '}
            <span className={deltaCls}>{deltaLabel}</span>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-accent">All core sections complete 🎉</div>
      )}
    </div>
  );
}
