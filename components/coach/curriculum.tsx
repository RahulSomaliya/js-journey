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
  // One section open at a time; all collapsed by default.
  const [openId, setOpenId] = useState<number | null>(null);
  const doneCount = rows.filter((r) => r.status === 'done').length;
  const watched = rows.reduce((n, r) => n + r.minutesLogged, 0);
  const totalVideo = rows.reduce((n, r) => n + r.section.videoMinutes, 0);

  return (
    <section className="rounded-2xl border border-hair bg-surface shadow">
      <div className="border-b border-hair px-6 py-4">
        <h2 className="font-serif text-xl text-ink">Full curriculum</h2>
        <p className="mt-0.5 text-sm text-muted">
          {doneCount} / {rows.length} sections done · {fmtDur(watched)} of {fmtDur(totalVideo)} watched
        </p>
      </div>

      <ul>
        {rows.map((r) => {
          const isOpen = openId === r.section.id;
          const isCurrent = r.section.id === currentSectionId;
          const isSkip = r.section.kind === 'skip';
          const meta = STATUS[r.status];
          const items = lessons[r.section.id] ?? [];

          return (
            <li
              key={r.section.id}
              className={`border-t border-hair ${isCurrent ? 'border-l-2 border-l-accent' : ''} ${isSkip ? 'opacity-60' : ''}`}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : r.section.id)}
                className="flex w-full items-center gap-5 px-6 py-3.5 text-left transition-colors hover:bg-surface-2"
                aria-expanded={isOpen}
              >
                <span className="w-8 shrink-0 text-sm font-semibold text-faint">S{r.section.id}</span>
                <span className="flex-1 font-medium text-ink">
                  {r.section.title}
                  {r.section.kind !== 'core' && (
                    <span className="ml-2 text-[0.65rem] uppercase tracking-wider text-faint">{r.section.kind}</span>
                  )}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">{fmtDur(r.section.videoMinutes)}</span>
                <span className={`w-24 shrink-0 text-right text-sm ${meta.cls}`}>{meta.label}</span>
                <span className={`shrink-0 text-faint transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>›</span>
              </button>

              {/* smooth height animation via grid-rows 0fr → 1fr */}
              <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="px-6 pb-5 pl-[4.5rem]">
                    {items.length === 0 ? (
                      <p className="text-sm text-faint">Lessons coming soon.</p>
                    ) : (
                      <ol className="grid grid-cols-2 gap-x-12 gap-y-1.5">
                        {items.map((l, i) => (
                          <li key={i} className="flex justify-between gap-4 text-sm text-muted">
                            <span>
                              <span className="text-faint">{i + 1}.</span> {l.title}
                            </span>
                            {l.minutes != null && <span className="shrink-0 tabular-nums text-faint">{fmtDur(l.minutes)}</span>}
                          </li>
                        ))}
                      </ol>
                    )}
                    {r.targetFriday && (
                      <p className="mt-4 text-[0.7rem] uppercase tracking-wider text-faint">Target by {fmtDate(r.targetFriday)}</p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
