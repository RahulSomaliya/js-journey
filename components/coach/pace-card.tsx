import type { PaceResult } from '@/lib/schedule';
import { fmtDur } from '@/lib/format';
import { Countdown } from './countdown';

export function PaceCard({ pace, target, deadline }: { pace: PaceResult; target: string; deadline: string }) {
  const expected = pace.notStarted ? 'not started' : fmtDur(pace.idealContentMinutes);
  return (
    <div className="rounded-2xl border border-hair bg-surface p-6 shadow">
      {/* the three numbers that answer "on track?" — emphasized */}
      <div className="grid grid-cols-3 gap-6">
        <div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Content done</div>
          <div className="mt-1 font-serif text-2xl text-ink">{fmtDur(pace.contentMinutesDone)} <span className="text-muted">/ {fmtDur(pace.contentMinutesTotal)}</span></div>
        </div>
        <div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Projected finish</div>
          <div className="mt-1 font-serif text-2xl text-ink">{pace.projectedFinishDate ?? '—'}</div>
        </div>
        <div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Deadline</div>
          <div className="mt-1 font-serif text-2xl text-accent-deep">{deadline}</div>
          <div className="mt-0.5 text-xs text-muted"><Countdown deadline={deadline} /></div>
        </div>
      </div>
      {/* supporting context — quieted */}
      <div className="mt-5 grid grid-cols-3 gap-6 border-t border-hair pt-4 text-sm">
        <div><span className="text-faint">Expected by today</span> <span className="text-ink-2">{expected}</span></div>
        <div><span className="text-faint">Effort</span> <span className="text-ink-2">{fmtDur(pace.effortMinutes)}{pace.notStarted ? '' : ` / ${fmtDur(pace.idealEffortMinutes)}`}</span></div>
        <div><span className="text-faint">Course target</span> <span className="text-accent">{target}</span></div>
      </div>
    </div>
  );
}
