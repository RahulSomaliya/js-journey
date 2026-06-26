'use client';
import { useEffect, useRef, useState } from 'react';
import type { Section } from '@/lib/schedule';

// Custom, token-styled section picker. Finished sections show a ✓ and can't be
// re-selected — you only log against what's still ahead of you.
export function SectionSelect({
  sections,
  value,
  onChange,
  finishedIds,
}: {
  sections: Section[];
  value: number | null;
  onChange: (id: number) => void;
  finishedIds: number[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = sections.find((s) => s.id === value) ?? null;

  // close on outside click / Escape (positioning-independent)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-hair bg-surface-2 p-3 text-left text-ink transition-colors hover:border-hair-strong focus:border-accent focus:outline-none"
      >
        <span>{selected ? `${selected.id}. ${selected.title}` : 'Choose a section'}</span>
        <span className={`text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <ul className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-hair bg-surface p-1 shadow-lg">
          {sections.map((s) => {
            const isDone = finishedIds.includes(s.id);
            const isSelected = s.id === value;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={isDone}
                  onClick={() => {
                    if (!isDone) {
                      onChange(s.id);
                      setOpen(false);
                    }
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isDone
                      ? 'cursor-not-allowed text-faint'
                      : isSelected
                        ? 'bg-accent-soft text-accent-deep'
                        : 'text-ink hover:bg-surface-2'
                  }`}
                >
                  <span className={`w-4 shrink-0 ${isDone ? 'text-accent' : 'text-transparent'}`}>✓</span>
                  <span className={isDone ? 'line-through' : ''}>
                    {s.id}. {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
