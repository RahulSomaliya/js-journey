import type { Phase, DynamicSchedule } from '@/lib/schedule';
import { fmtDur, fmtDate } from '@/lib/format';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 text-center">
      <div className="font-serif text-2xl font-semibold text-ink">{value}</div>
      <div className="text-[0.7rem] uppercase tracking-wider text-faint">{label}</div>
    </div>
  );
}

export function JourneyStats({
  sectionsDone, totalSections, effortMinutes, phase, dyn, daysToDeadline,
}: {
  sectionsDone: number; totalSections: number; effortMinutes: number;
  phase: Phase | null; dyn: DynamicSchedule; daysToDeadline: number;
}) {
  const d = dyn.daysDelta;
  const buffer = d > 0
    ? { text: `🎉 You're ${d} day${d === 1 ? '' : 's'} ahead — keep banking time!`, cls: 'text-accent' }
    : d < 0
      ? { text: `You're ${-d} day${d === -1 ? '' : 's'} behind — one good session brings it back. 💚`, cls: 'text-warn' }
      : { text: 'Right on schedule. 💚', cls: 'text-muted' };
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Your journey</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Tile label="sections" value={`${sectionsDone}/${totalSections}`} />
        <Tile label="invested" value={fmtDur(effortMinutes)} />
        <Tile label="days left" value={String(Math.max(0, daysToDeadline))} />
      </div>
      {phase && <p className="mt-3 text-sm text-muted">You&apos;re in <span className="font-medium text-ink">Phase {phase.n}: {phase.name}</span>.</p>}
      {dyn.currentSection ? (
        <p className="mt-1 text-sm text-muted">
          {dyn.isCurrentOverdue ? 'Catch up: finish ' : 'Next checkpoint: finish '}
          <span className="font-medium text-ink">{dyn.currentSection.title}</span>
          {dyn.currentDueDate ? <> by <span className="font-medium text-ink">{fmtDate(dyn.currentDueDate)}</span></> : null}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-accent">Course complete — you did it! 🎉</p>
      )}
      <p className="mt-1 text-sm text-muted">On this pace you&apos;ll finish by <span className="font-medium text-ink">{fmtDate(dyn.projectedFinishDate)}</span>.</p>
      <p className={`mt-2 text-sm font-medium ${buffer.cls}`}>{buffer.text}</p>
    </div>
  );
}
