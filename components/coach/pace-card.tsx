import type { PaceResult } from '@/lib/schedule';
import { Countdown } from './countdown';

export function PaceCard({ pace, target, deadline }: { pace: PaceResult; target: string; deadline: string }) {
  const idealH = (pace.idealContentMinutes / 60).toFixed(1);
  const doneH = (pace.contentMinutesDone / 60).toFixed(1);
  const totalH = (pace.contentMinutesTotal / 60).toFixed(1);
  const effH = (pace.effortMinutes / 60).toFixed(1);
  const effIdealH = (pace.idealEffortMinutes / 60).toFixed(1);
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
        <div><div className="text-faint">Content done</div><div className="font-serif text-xl text-ink">{doneH}h / {totalH}h</div></div>
        <div><div className="text-faint">Expected by today</div><div className="font-serif text-xl text-ink">{idealH}h</div></div>
        <div><div className="text-faint">Effort</div><div className="font-serif text-xl text-ink">{effH}h / {effIdealH}h</div></div>
        <div><div className="text-faint">Projected finish</div><div className="font-serif text-xl text-ink">{pace.projectedFinishDate ?? '—'}</div></div>
        <div><div className="text-faint">Course target</div><div className="font-serif text-xl text-accent-deep">{target}</div></div>
        <div><div className="text-faint">Deadline</div><div className="font-serif text-xl text-accent-deep">{deadline}</div><div className="mt-0.5 text-xs"><Countdown deadline={deadline} /></div></div>
      </div>
    </div>
  );
}
