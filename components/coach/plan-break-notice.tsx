import { breakStudyDays, type PlanBreak } from '@/lib/schedule';
import { addStudyDays, diffDays } from '@/lib/date';
import { fmtDate, fmtDateRange } from '@/lib/format';

// Rahul's side of a plan break (planBreakFor): plain facts — what the dates already include.
export function PlanBreakNotice({ planBreak, breaks, today }: {
  planBreak: PlanBreak; breaks: readonly PlanBreak[]; today: string;
}) {
  const inProgress = today >= planBreak.start;
  const daysAway = diffDays(today, planBreak.start);
  return (
    <div className="rounded-xl border border-hair bg-surface-2 px-5 py-3 text-sm text-muted">
      <span className="font-medium text-ink">Plan break: {planBreak.label}</span>, {fmtDateRange(planBreak.start, planBreak.end)}{' '}
      ({breakStudyDays(planBreak)} study days) —{' '}
      {inProgress ? <>in progress, back {fmtDate(addStudyDays(planBreak.end, 1, breaks))}.</> : <>starts in {daysAway} day{daysAway === 1 ? '' : 's'}.</>}{' '}
      Target and deadline already include it; pace, due dates, streak and the daily no-log email pause during it.
    </div>
  );
}
