import type { PaceResult } from '@/lib/schedule';
import { fmtDur } from '@/lib/format';
import { Countdown } from './countdown';

export function PaceCard({ pace, target, deadline }: { pace: PaceResult; target: string; deadline: string }) {
  const expected = pace.notStarted ? 'not started' : fmtDur(pace.idealContentMinutes);
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
        <div><div className="text-faint">Content done</div><div className="font-serif text-xl text-ink">{fmtDur(pace.contentMinutesDone)} / {fmtDur(pace.contentMinutesTotal)}</div></div>
        <div><div className="text-faint">Expected by today</div><div className="font-serif text-xl text-ink">{expected}</div></div>
        <div><div className="text-faint">Effort</div><div className="font-serif text-xl text-ink">{fmtDur(pace.effortMinutes)}{pace.notStarted ? '' : ` / ${fmtDur(pace.idealEffortMinutes)}`}</div></div>
        <div><div className="text-faint">Projected finish</div><div className="font-serif text-xl text-ink">{pace.projectedFinishDate ?? '—'}</div></div>
        <div><div className="text-faint">Course target</div><div className="font-serif text-xl text-accent-deep">{target}</div></div>
        <div><div className="text-faint">Deadline</div><div className="font-serif text-xl text-accent-deep">{deadline}</div><div className="mt-0.5 text-xs"><Countdown deadline={deadline} /></div></div>
      </div>
    </div>
  );
}
