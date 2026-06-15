import type { PaceResult } from '@/lib/schedule';

const TONE: Record<PaceResult['status'], string> = {
  ahead: 'text-accent', on_track: 'text-accent', behind: 'text-warn',
};

export function StatusHeadline({ pace }: { pace: PaceResult }) {
  const gapH = Math.abs(pace.gapMinutes / 60).toFixed(1);
  const msg = pace.status === 'behind' ? `Behind by ${gapH}h (~${Math.abs(pace.daysOffPace)} study-days)`
    : pace.status === 'ahead' ? `Ahead by ${gapH}h` : 'On track';
  return (
    <div>
      <div className={`font-serif text-3xl font-semibold ${TONE[pace.status]}`}>{msg}</div>
      <p className="mt-1 text-muted">{pace.contentPct}% complete · {(pace.effortMinutes / 60).toFixed(1)}h logged vs {(pace.idealEffortMinutes / 60).toFixed(1)}h expected by today</p>
    </div>
  );
}
