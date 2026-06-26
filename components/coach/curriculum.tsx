'use client';

import { useState } from 'react';
import type { CurriculumRow, SectionStatus } from '@/lib/schedule';
import type { Lesson } from '@/lib/lessons';
import { fmtDur, fmtDate } from '@/lib/format';

const STATUS: Record<SectionStatus, { label: string; cls: string }> = {
  done: { label: 'done ✓', cls: 'text-accent' },
  in_progress: { label: 'in progress', cls: 'text-accent-deep' },
  overdue: { label: 'overdue', cls: 'text-warn' },
  upcoming: { label: 'upcoming', cls: 'text-faint' },
};

export function Curriculum({
  rows,
  lessons,
  currentSectionId,
}: {
  rows: CurriculumRow[];
  lessons: Record<number, Lesson[]>;
  currentSectionId: number | null;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set()); // collapsed by default
  const doneCount = rows.filter((r) => r.status === 'done').length;
  const watched = rows.reduce((n, r) => n + r.minutesLogged, 0);
  const totalVideo = rows.reduce((n, r) => n + r.section.videoMinutes, 0);
  const allOpen = open.size === rows.length;

  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setAll = (openAll: boolean) =>
    setOpen(openAll ? new Set(rows.map((r) => r.section.id)) : new Set());

  return (
    <section className="rounded-2xl border border-hair bg-surface shadow">
      <div className="flex items-baseline justify-between border-b border-hair px-6 py-4">
        <div>
          <h2 className="font-serif text-xl text-ink">Full curriculum</h2>
          <p className="mt-0.5 text-sm text-muted">
            {doneCount} / {rows.length} sections done · {fmtDur(watched)} of {fmtDur(totalVideo)} watched
          </p>
        </div>
        <button
          onClick={() => setAll(!allOpen)}
          className="text-sm font-medium text-accent transition-colors hover:text-accent-deep"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <ul>
        {rows.map((r) => {
          const isOpen = open.has(r.section.id);
          const isCurrent = r.section.id === currentSectionId;
          const isSkip = r.section.kind === 'skip';
          const meta = STATUS[r.status];
          const items = lessons[r.section.id] ?? [];
          const pct = r.section.videoMinutes
            ? Math.min(100, Math.round((r.minutesLogged / r.section.videoMinutes) * 100))
            : 0;

          return (
            <li
              key={r.section.id}
              className={`border-t border-hair ${isCurrent ? 'border-l-2 border-l-accent' : ''} ${isSkip ? 'opacity-60' : ''}`}
            >
              <button
                onClick={() => toggle(r.section.id)}
                className="flex w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-surface-2"
                aria-expanded={isOpen}
              >
                <span className="w-8 shrink-0 text-sm font-semibold text-faint">S{r.section.id}</span>
                <span className="flex-1 font-medium text-ink">
                  {r.section.title}
                  {r.section.kind !== 'core' && (
                    <span className="ml-2 text-[0.65rem] uppercase tracking-wider text-faint">{r.section.kind}</span>
                  )}
                </span>
                <span className="w-28 shrink-0" aria-hidden>
                  <span className="block h-1 rounded-full bg-hair">
                    <span className="block h-1 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <span className="w-16 shrink-0 text-right text-sm text-muted">{fmtDur(r.section.videoMinutes)}</span>
                <span className={`w-24 shrink-0 text-right text-sm ${meta.cls}`}>{meta.label}</span>
                <span className={`shrink-0 text-faint transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
              </button>

              {isOpen && (
                <div className="px-6 pb-4 pl-[4.25rem]">
                  {items.length === 0 ? (
                    <p className="text-sm text-faint">Lessons coming soon.</p>
                  ) : (
                    <ol className="space-y-1">
                      {items.map((l, i) => (
                        <li key={i} className="flex justify-between gap-4 text-sm text-muted">
                          <span>
                            <span className="text-faint">{i + 1}.</span> {l.title}
                          </span>
                          {l.minutes != null && <span className="shrink-0 text-faint">{fmtDur(l.minutes)}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                  {r.targetFriday && (
                    <p className="mt-3 text-[0.7rem] uppercase tracking-wider text-faint">
                      Target by {fmtDate(r.targetFriday)}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
