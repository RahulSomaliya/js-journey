import type { PlanBreak } from '@/lib/schedule';
import { addStudyDays, diffDays } from '@/lib/date';
import { fmtDate, fmtDateRange } from '@/lib/format';

// Mansi's side of a plan break (planBreakFor: in progress, or starting within 14 days).
// Warm, and clear that nothing is lost — every pace number already skips these days.
export function BreakCard({ planBreak, breaks, today }: {
  planBreak: PlanBreak; breaks: readonly PlanBreak[]; today: string;
}) {
  const icon = /diwali/i.test(planBreak.label) ? '🪔' : '🌿';
  const inProgress = today >= planBreak.start;
  const backOn = addStudyDays(planBreak.end, 1, breaks);
  const daysAway = diffDays(today, planBreak.start);
  return (
    <div className="rounded-2xl bg-warn-soft p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-warn">
        {icon} Your {planBreak.label} break · {fmtDateRange(planBreak.start, planBreak.end)}
      </div>
      <p className="mt-2 font-serif text-lg leading-relaxed text-ink-2">
        {inProgress ? (
          <>Enjoy it — nothing to study until <span className="font-medium text-ink">{fmtDate(backOn)}</span>. Your plan already counts these days, so your pace and streak are simply paused. 💚</>
        ) : (
          <>{daysAway === 1 ? 'Starts tomorrow' : `Starts in ${daysAway} days`} and it&apos;s built into your plan: no study expected those days, and your pace won&apos;t drop a bit. 💚</>
        )}
      </p>
    </div>
  );
}
