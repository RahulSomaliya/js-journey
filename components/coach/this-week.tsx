import type { LogEntry, DynamicSchedule } from '@/lib/schedule';
import { sectionEffortMinutes, phaseForWeek } from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { fmtDur, fmtDate } from '@/lib/format';

export function ThisWeek({ week, dyn, logs }: { week: number; dyn: DynamicSchedule; logs: LogEntry[] }) {
  const cur = dyn.currentSection;
  const phase = phaseForWeek(week);
  const curEffort = cur ? sectionEffortMinutes(logs, cur.id) : 0;
  const curBudget = cur ? Math.round(cur.videoMinutes * PLAN.multiplier) : 0;
  const d = dyn.daysDelta;
  const deltaLabel =
    d > 0 ? `${d} day${d === 1 ? '' : 's'} ahead of schedule`
      : d < 0 ? `${-d} day${d === -1 ? '' : 's'} behind schedule`
        : 'right on schedule';
  const deltaCls = d >= 0 ? 'text-accent' : 'text-warn';
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">This week · Week {week || '—'}</div>
        {phase && <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">Phase {phase.n}: {phase.name}</div>}
      </div>
      {cur ? (
        <div className="mt-3 space-y-1">
          <div className="text-ink">Current: <span className="font-medium">S{cur.id} {cur.title}</span></div>
          <div className="text-sm text-muted">{fmtDur(curEffort)} spent vs {fmtDur(curBudget)} budgeted for this section</div>
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
