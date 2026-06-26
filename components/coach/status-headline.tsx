import type { PaceResult } from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { fmtDur, fmtDate } from '@/lib/format';

const TONE: Record<PaceResult['status'], string> = {
  ahead: 'text-accent', on_track: 'text-accent', behind: 'text-warn',
};

export function StatusHeadline({ pace }: { pace: PaceResult }) {
  if (pace.notStarted) {
    return (
      <div>
        <div className="font-serif text-4xl font-semibold tracking-tight text-accent">Starts {fmtDate(PLAN.startDate)}</div>
        <p className="mt-1 text-muted">
          {pace.contentPct}% complete · {fmtDur(pace.effortMinutes)} logged so far
          {pace.effortMinutes > 0 ? ' — a head start! ✨' : ''}
        </p>
      </div>
    );
  }
  const gap = fmtDur(Math.abs(pace.gapMinutes));
  const msg = pace.status === 'behind' ? `Behind by ${gap} (~${Math.abs(pace.daysOffPace)} study-days)`
    : pace.status === 'ahead' ? `Ahead by ${gap}` : 'On track';
  return (
    <div>
      <div className={`font-serif text-4xl font-semibold tracking-tight ${TONE[pace.status]}`}>{msg}</div>
      <p className="mt-1 text-muted">{pace.contentPct}% complete · {fmtDur(pace.effortMinutes)} logged vs {fmtDur(pace.idealEffortMinutes)} expected by today</p>
    </div>
  );
}
