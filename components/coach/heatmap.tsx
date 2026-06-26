import type { ReactNode } from 'react';
import type { LogEntry } from '@/lib/schedule';
import { addDays, dayOfWeek, diffDays } from '@/lib/date';
import { fmtDur } from '@/lib/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']; // Sun..Sat rows

function level(min: number): number {
  if (min <= 0) return 0;
  if (min <= 30) return 1;
  if (min <= 60) return 2;
  if (min <= 120) return 3;
  return 4;
}

// Empty → faint border colour; filled levels ramp the accent over the card surface.
const FILL = [
  'var(--hair)',
  'color-mix(in srgb, var(--accent) 28%, var(--surface-2))',
  'color-mix(in srgb, var(--accent) 52%, var(--surface-2))',
  'color-mix(in srgb, var(--accent) 78%, var(--surface-2))',
  'var(--accent)',
];

export function Heatmap({
  logs,
  startDate,
  weeks,
  today,
  streakDays,
  center,
}: {
  logs: LogEntry[];
  startDate: string;
  weeks: number;
  today: string;
  streakDays: number;
  center?: ReactNode;
}) {
  const byDate = new Map<string, number>();
  for (const l of logs) byDate.set(l.studyDate, (byDate.get(l.studyDate) ?? 0) + l.minutes);

  const earliest = logs.reduce((min, l) => (l.studyDate < min ? l.studyDate : min), startDate);
  const anchor = earliest < startDate ? earliest : startDate;
  const renderStart = addDays(anchor, -dayOfWeek(anchor)); // back to the Sunday
  const planEnd = addDays(startDate, weeks * 7);
  const lastDay = today > planEnd ? today : planEnd;
  const numWeeks = Math.ceil((diffDays(renderStart, lastDay) + 1) / 7);

  const studyDays = byDate.size;
  const totalMin = [...byDate.values()].reduce((a, b) => a + b, 0);

  // Month label appears on the first column whose Sunday lands in a new month.
  const monthAt: (string | null)[] = [];
  let prevMonth = -1;
  for (let w = 0; w < numWeeks; w++) {
    const m = +addDays(renderStart, w * 7).slice(5, 7) - 1;
    monthAt.push(m !== prevMonth ? MONTHS[m] : null);
    prevMonth = m;
  }

  return (
    <div className="rounded-2xl border border-hair bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Study days</div>
        <div className="flex items-center gap-1 text-[0.65rem] text-faint">
          less
          {FILL.map((c, i) => (
            <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
          ))}
          more
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-8">
        <div className="flex gap-2">
          {/* day-of-week labels */}
          <div className="flex flex-col gap-1 pt-[20px]">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="flex h-3.5 items-center text-[0.6rem] leading-none text-faint">{d}</div>
            ))}
          </div>
          {/* graph */}
          <div>
            <div className="mb-1 flex gap-1">
              {monthAt.map((m, w) => (
                <div key={w} className="w-3.5 shrink-0 whitespace-nowrap text-[0.6rem] leading-none text-faint">{m}</div>
              ))}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: numWeeks }, (_, w) => (
                <div key={w} className="flex flex-col gap-1">
                  {Array.from({ length: 7 }, (_, d) => {
                    const date = addDays(renderStart, w * 7 + d);
                    const future = date > today;
                    const min = byDate.get(date) ?? 0;
                    const isToday = date === today;
                    return (
                      <div
                        key={d}
                        title={`${date}: ${fmtDur(min)}`}
                        className="h-3.5 w-3.5 rounded-[3px]"
                        style={{
                          background: future ? 'var(--surface-2)' : FILL[level(min)],
                          boxShadow: isToday ? 'inset 0 0 0 1.5px var(--accent-deep)' : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* optional centre slot (e.g. shuffling motivations on the student view) */}
        {center && <div className="flex flex-1 justify-center px-8 text-center">{center}</div>}

        {/* summary — uses the horizontal space */}
        <div className="flex gap-8 border-l border-hair pl-8">
          <div>
            <div className="font-serif text-2xl text-ink">{streakDays}</div>
            <div className="text-[0.7rem] uppercase tracking-wider text-faint">day streak</div>
          </div>
          <div>
            <div className="font-serif text-2xl text-ink">{studyDays}</div>
            <div className="text-[0.7rem] uppercase tracking-wider text-faint">study days</div>
          </div>
          <div>
            <div className="font-serif text-2xl text-ink">{fmtDur(totalMin)}</div>
            <div className="text-[0.7rem] uppercase tracking-wider text-faint">total time</div>
          </div>
        </div>
      </div>
    </div>
  );
}
