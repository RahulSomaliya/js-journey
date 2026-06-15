import type { Phase, WeeklyMilestone } from '@/lib/schedule';
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
  sectionsDone, totalSections, effortMinutes, phase, milestone, daysToDeadline,
}: {
  sectionsDone: number; totalSections: number; effortMinutes: number;
  phase: Phase | null; milestone: WeeklyMilestone | null; daysToDeadline: number;
}) {
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Your journey</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Tile label="sections" value={`${sectionsDone}/${totalSections}`} />
        <Tile label="invested" value={fmtDur(effortMinutes)} />
        <Tile label="days left" value={String(Math.max(0, daysToDeadline))} />
      </div>
      {phase && <p className="mt-3 text-sm text-muted">You&apos;re in <span className="font-medium text-ink">Phase {phase.n}: {phase.name}</span>.</p>}
      {milestone && (
        <p className="mt-1 text-sm text-muted">
          Next checkpoint: <span className="font-medium text-ink">finish Section {milestone.throughSectionId}</span> by {fmtDate(milestone.fridayDate)}.
        </p>
      )}
    </div>
  );
}
