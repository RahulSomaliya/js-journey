'use client';
import { useState, type KeyboardEvent } from 'react';
import { fmtDate, fmtSeconds, fmtShortDate } from '@/lib/format';

// Last 30 days of study time — the Course Player's chart (screens/home/ThirtyDays.tsx), same rules:
// one series → no legend; bars ≤ 20 px, 4 px rounded tops; today in the accent, other days in
// `chart-bar`; a hairline average line labelled at its end — in a right gutter (pr-20) OUTSIDE the
// plot: drawn inside it, the label's canvas chip sat on today's bar and the one before it, the two that
// matter most (2026-10-01 review); a hover/focus tooltip ("Tue 29 Sep · 1h 12m"); a visually hidden
// table carries every value. Bars rise from 25 % of their height on first paint (never from nothing —
// a screenshot always shows real bars).

/** Clean top of the scale: at least 1 h, then the next whole half hour (≤ 3 h) or hour. */
function niceTop(seconds: number): number {
  if (seconds <= 3600) return 3600;
  if (seconds <= 3 * 3600) return Math.ceil(seconds / 1800) * 1800;
  return Math.ceil(seconds / 3600) * 3600;
}

export function ThirtyDays({ days, averageSeconds, today, emptyText }: {
  /** oldest → today, 30 entries (JourneyStats.last30.days) */
  days: { date: string; seconds: number }[];
  averageSeconds: number;
  today: string;
  emptyText: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceTop(Math.max(averageSeconds, ...days.map((d) => d.seconds)));
  const empty = days.every((d) => d.seconds < 60);
  const pct = (s: number) => (s / top) * 100;
  const shown = active === null ? null : days[active];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    setActive((i) => {
      if (e.key === 'Home') return 0;
      if (e.key === 'End') return days.length - 1;
      const from = i ?? days.length - 1;
      return Math.max(0, Math.min(days.length - 1, from + (e.key === 'ArrowLeft' ? -1 : 1)));
    });
  };

  return (
    <section aria-labelledby="thirty-title">
      <h2 id="thirty-title" className="text-base font-semibold text-ink">Last 30 days</h2>
      <div
        role="group"
        aria-label="Daily study time for the last 30 days. Use the arrow keys to read each day."
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        className="mt-4 rounded-sm pr-20"
      >
        <div className="relative h-40">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-line" aria-hidden="true">
            <span className="absolute left-0 top-1 text-xs tabular-nums text-ink-subtle">{fmtSeconds(top)}</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-line" aria-hidden="true" />

          {empty && <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ink-muted">{emptyText}</p>}

          <div className="absolute inset-0 flex items-end gap-0.5" aria-hidden="true">
            {days.map((d, i) => {
              const isToday = d.date === today;
              const on = i === active;
              const h = d.seconds > 0 ? Math.max(pct(d.seconds), 1.5) : 0;
              const fill = isToday ? (on ? 'bg-accent-hover' : 'bg-accent') : on ? 'bg-chart-bar-hover' : 'bg-chart-bar';
              return (
                <div key={d.date} data-day={d.date} className="flex h-full flex-1 items-end justify-center" onPointerEnter={() => setActive(i)}>
                  <div className={`w-full max-w-5 origin-bottom animate-bar-rise rounded-t-sm ${fill}`} style={{ height: `${h}%`, animationDelay: `${i * 12}ms` }} />
                </div>
              );
            })}
          </div>

          {averageSeconds >= 60 && (
            <div className="pointer-events-none absolute inset-x-0 border-t border-ink-subtle" style={{ bottom: `${pct(averageSeconds)}%` }} aria-hidden="true">
              {/* in the gutter (pr-20 above), level with the line — never over the bars */}
              <span className="absolute left-full top-0 -translate-y-1/2 whitespace-nowrap pl-2 text-xs tabular-nums text-ink-muted">avg {fmtSeconds(averageSeconds)}</span>
            </div>
          )}

          {shown && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm shadow-e2"
              style={{
                left: `${((active + 0.5) / days.length) * 100}%`,
                bottom: `calc(${Math.min(pct(shown.seconds), 100)}% + 8px)`,
                transform: `translateX(${active < 4 ? '-15%' : active > days.length - 5 ? '-85%' : '-50%'})`,
              }}
            >
              <span className="font-semibold tabular-nums text-ink">{fmtSeconds(shown.seconds)}</span>
              <span className="text-ink-muted"> · {shown.date === today ? 'Today' : fmtDate(shown.date)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex justify-between pr-20 text-xs text-ink-subtle" aria-hidden="true">
        <span>{fmtShortDate(days[0]?.date ?? today)}</span>
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>Study time per day, last 30 days</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{fmtDate(d.date)}</th>
              <td>{fmtSeconds(d.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
