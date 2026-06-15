import type { LogEntry } from '@/lib/schedule';
import { addDays, dayOfWeek, diffDays } from '@/lib/date';
import { fmtDur } from '@/lib/format';

function mondayOf(iso: string): string {
  return addDays(iso, -((dayOfWeek(iso) + 6) % 7));
}

export function Heatmap({ logs, startDate, weeks, today }: { logs: LogEntry[]; startDate: string; weeks: number; today: string }) {
  const byDate = new Map<string, number>();
  for (const l of logs) byDate.set(l.studyDate, (byDate.get(l.studyDate) ?? 0) + l.minutes);
  // anchor the grid so any logged day (even before the official start) is visible
  const earliest = logs.reduce((min, l) => (l.studyDate < min ? l.studyDate : min), startDate);
  const renderStart = mondayOf(earliest < startDate ? earliest : startDate);
  const extraWeeks = Math.max(0, Math.round(diffDays(renderStart, startDate) / 7));
  const totalWeeks = weeks + extraWeeks;
  const cell = (min: number) => (min === 0 ? 'var(--hair)' : min < 60 ? 'var(--accent-soft)' : min < 150 ? 'var(--accent)' : 'var(--accent-deep)');
  const swatch = ['var(--hair)', 'var(--accent-soft)', 'var(--accent)', 'var(--accent-deep)'];
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="flex items-center justify-between">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Study days</div>
        <div className="flex items-center gap-1 text-[0.65rem] text-faint">
          less
          {swatch.map((c, i) => <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />)}
          more
        </div>
      </div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {Array.from({ length: totalWeeks }, (_, w) => (
          <div key={w} className="flex flex-col gap-1.5">
            {Array.from({ length: 5 }, (_, d) => {
              const date = addDays(renderStart, w * 7 + d);
              const min = byDate.get(date) ?? 0;
              const isToday = date === today;
              return (
                <div
                  key={d}
                  title={`${date}: ${fmtDur(min)}`}
                  className="h-4 w-4 rounded-[3px]"
                  style={{ background: cell(min), outline: isToday ? '2px solid var(--accent-deep)' : undefined, outlineOffset: isToday ? '1px' : undefined }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
