import type { WeeklyMilestone, Section, LogEntry } from '@/lib/schedule';
import { finishedSectionIds, currentSection, sectionEffortMinutes, phaseForWeek } from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { fmtDur } from '@/lib/format';

export function ThisWeek({ week, milestone, sections, logs }: { week: number; milestone: WeeklyMilestone | null; sections: Section[]; logs: LogEntry[] }) {
  const done = finishedSectionIds(logs);
  const cur = currentSection(sections, logs);
  const phase = phaseForWeek(week);
  const curEffort = cur ? sectionEffortMinutes(logs, cur.id) : 0;
  const curBudget = cur ? Math.round(cur.videoMinutes * PLAN.multiplier) : 0;
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="flex items-baseline justify-between">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">This week · Week {week || '—'}</div>
        {phase && <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">Phase {phase.n}: {phase.name}</div>}
      </div>
      {cur ? (
        <div className="mt-3 space-y-1">
          <div className="text-ink">Current: <span className="font-medium">S{cur.id} {cur.title}</span> <span className="text-faint">· in progress</span></div>
          <div className="text-sm text-muted">{fmtDur(curEffort)} spent vs {fmtDur(curBudget)} budgeted for this section</div>
          {milestone && <div className="text-sm text-muted">Target by {milestone.fridayDate}: through S{milestone.throughSectionId} {done.has(milestone.throughSectionId) ? <span className="text-accent">✓</span> : <span className="text-faint">(not yet)</span>}</div>}
        </div>
      ) : <div className="mt-3 text-accent">All core sections complete 🎉</div>}
    </div>
  );
}
