import type { LogEntry } from '@/lib/schedule';
import { addDays } from '@/lib/date';

export function Heatmap({ logs, startDate, weeks }: { logs: LogEntry[]; startDate: string; weeks: number }) {
  const byDate = new Map<string, number>();
  for (const l of logs) byDate.set(l.studyDate, (byDate.get(l.studyDate) ?? 0) + l.minutes);
  const cell = (min: number) => (min === 0 ? 'var(--hair)' : min < 60 ? 'var(--accent-soft)' : min < 150 ? 'var(--accent)' : 'var(--accent-deep)');
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Study days</div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto">
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} className="flex flex-col gap-1.5">
            {Array.from({ length: 5 }, (_, d) => {
              const date = addDays(startDate, w * 7 + d);
              const min = byDate.get(date) ?? 0;
              return <div key={d} title={`${date}: ${(min / 60).toFixed(1)}h`} className="h-4 w-4 rounded-[3px]" style={{ background: cell(min) }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
