import type { PaceResult } from '@/lib/schedule';
import { fmtDur } from '@/lib/format';
import { Countdown } from './countdown';

function Bar({ label, pct, tone }: { label: string; pct: number; tone: 'accent' | 'neutral' }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-40 shrink-0 text-sm text-muted">{label}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair">
        <span
          className="block h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(100, pct)}%`, background: tone === 'accent' ? 'var(--accent)' : 'var(--ink-2)' }}
        />
      </span>
      <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-ink">{pct}%</span>
    </div>
  );
}

export function PaceCard({
  pace,
  target,
  deadline,
  timelinePct,
}: {
  pace: PaceResult;
  target: string;
  deadline: string;
  timelinePct: number;
}) {
  const expected = pace.notStarted ? 'not started' : fmtDur(pace.idealContentMinutes);
  const coursePct = Math.round(pace.contentPct);
  const diff = coursePct - timelinePct;
  const verdict = diff > 0 ? `${diff}% ahead of schedule` : diff < 0 ? `${-diff}% behind schedule` : 'exactly on schedule';

  return (
    <div className="rounded-2xl border border-hair bg-surface p-6 shadow">
      {/* the three numbers that answer "on track?" — emphasized */}
      <div className="grid grid-cols-3 gap-6">
        <div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Content done</div>
          <div className="mt-1 font-serif text-2xl text-ink">
            {fmtDur(pace.contentMinutesDone)} <span className="text-muted">/ {fmtDur(pace.contentMinutesTotal)}</span>
          </div>
        </div>
        <div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Projected finish</div>
          <div className="mt-1 font-serif text-2xl text-ink">{pace.projectedFinishDate ?? '—'}</div>
        </div>
        <div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Deadline</div>
          <div className="mt-1 font-serif text-2xl text-accent-deep">{deadline}</div>
          <div className="mt-0.5 text-xs text-muted">
            <Countdown deadline={deadline} />
          </div>
        </div>
      </div>

      {/* progress vs pace — course completed vs time elapsed */}
      <div className="mt-6 space-y-2.5 border-t border-hair pt-5">
        <div className="flex items-center justify-between">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Progress vs pace</span>
          <span className={`text-sm font-medium ${diff >= 0 ? 'text-accent' : 'text-warn'}`}>{verdict}</span>
        </div>
        <Bar label="Course completed" pct={coursePct} tone="accent" />
        <Bar label="Timeline elapsed" pct={timelinePct} tone="neutral" />
      </div>

      {/* supporting context — quieted */}
      <div className="mt-6 grid grid-cols-3 gap-6 border-t border-hair pt-5 text-sm">
        <div>
          <span className="text-faint">Expected by today</span> <span className="text-ink-2">{expected}</span>
        </div>
        <div>
          <span className="text-faint">Effort</span>{' '}
          <span className="text-ink-2">
            {fmtDur(pace.effortMinutes)}
            {pace.notStarted ? '' : ` / ${fmtDur(pace.idealEffortMinutes)}`}
          </span>
        </div>
        <div>
          <span className="text-faint">Course target</span> <span className="text-accent">{target}</span>
        </div>
      </div>
    </div>
  );
}
