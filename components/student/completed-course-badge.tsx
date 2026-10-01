import type { CourseSummary } from '@/lib/db/queries';
import { fmtDate, fmtDur } from '@/lib/format';

// A finished course, kept small: a pill that opens to a few proud numbers.
// The popover is positioned against the nearest `relative` ancestor (the student
// header row), NOT the pill — anchored to the pill it ran 90px off a 390px screen.
export function CompletedCourseBadge({ shortTitle, title, summary }: { shortTitle: string; title: string; summary: CourseSummary }) {
  return (
    <details className="group inline-block">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-deep transition-colors hover:bg-accent hover:text-on-accent [&::-webkit-details-marker]:hidden">
        <span aria-hidden>✓</span> {shortTitle} · complete
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-72 max-w-full rounded-xl border border-hair bg-surface p-4 text-sm text-muted shadow-lg">
        <div className="font-serif text-base font-semibold text-ink">{title}</div>
        <p className="mt-1">
          {fmtDur(summary.minutes)} studied over {summary.studyDays} day{summary.studyDays === 1 ? '' : 's'}
          {summary.firstDate && summary.lastDate ? ` · ${fmtDate(summary.firstDate)} → ${fmtDate(summary.lastDate)}` : ''}
        </p>
        <p className="mt-2 text-accent">You did it — and everything in React stands on it. 💚</p>
      </div>
    </details>
  );
}
