import type { CurriculumRow } from '@/lib/schedule';
import { fmtDur } from '@/lib/format';

// Warm, student-facing view of the whole course: see how far you've come.
export function Roadmap({ rows, currentSectionId }: { rows: CurriculumRow[]; currentSectionId: number | null }) {
  const done = rows.filter((r) => r.status === 'done').length;
  return (
    <section className="rounded-2xl border border-hair bg-surface p-6 shadow">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-xl font-semibold text-ink">Your roadmap</h2>
        <span className="text-sm text-muted">{done} of {rows.length} sections done — keep going! 💚</span>
      </div>

      <ol className="mt-5 grid grid-cols-3 gap-3">
        {rows.map((r) => {
          const isCurrent = r.section.id === currentSectionId;
          const isDone = r.status === 'done';
          const isSkip = r.section.kind === 'skip';
          return (
            <li
              key={r.section.id}
              className={`rounded-xl border p-3.5 transition-colors ${isCurrent ? 'border-accent bg-accent-soft' : 'border-hair bg-surface-2'} ${isSkip ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    isDone ? 'bg-accent text-white' : isCurrent ? 'bg-accent-deep text-white' : 'bg-hair text-faint'
                  }`}
                >
                  {isDone ? '✓' : r.section.id}
                </span>
                <span className={`flex-1 truncate text-sm font-medium ${isCurrent ? 'text-ink' : isDone ? 'text-ink-2' : 'text-muted'}`}>
                  {r.section.title}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between pl-[2.125rem] text-[0.7rem]">
                <span className={`uppercase tracking-wider ${isCurrent ? 'font-semibold text-accent-deep' : 'text-faint'}`}>
                  {isCurrent ? "you're here ✨" : isDone ? 'done' : r.section.kind !== 'core' ? r.section.kind : 'upcoming'}
                </span>
                <span className="text-faint">{fmtDur(r.section.videoMinutes)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
