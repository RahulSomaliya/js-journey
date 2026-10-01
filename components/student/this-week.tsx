import type { WeekView } from '@/lib/journey-view';
import { CalendarIcon, PacePill, SectionHeading } from '@/components/ui';

// "This week" — the Course Player's block (screens/home/ThisWeek.tsx), from the same JourneyStatus:
// the week's goal + its Friday and the pace pill — not the course due date, which the Due stat right
// below shows. On a break the break replaces the pace, warmly; before the start, the start date does.
export function ThisWeek({ w }: { w: WeekView }) {
  return (
    <section aria-labelledby="week-title">
      <SectionHeading id="week-title" title="This week" meta={w.week} />
      <div className="mt-4 flex flex-col gap-4 rounded-lg border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6">
        {w.onBreak ? (
          <div className="flex items-start gap-3">
            <CalendarIcon className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <p className="text-base font-medium text-ink">{w.onBreak.label} · back {w.onBreak.back}</p>
              <p className="mt-0.5 text-sm text-ink-muted">Enjoy it — break days are not study days, so no pace is lost.</p>
            </div>
          </div>
        ) : (
          w.goal && (
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.06em] text-ink-muted">Goal</p>
              <p className="mt-1 text-base font-medium text-ink">
                {w.goal.text} <span className="whitespace-nowrap font-normal text-ink-muted">by {w.goal.due}</span>
              </p>
            </div>
          )
        )}
        {(w.pace || w.startsOn) && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
            {w.pace && <PacePill {...w.pace} />}
            {w.startsOn && <p className="text-sm text-ink-muted">Starts <span className="font-medium text-ink">{w.startsOn}</span></p>}
          </div>
        )}
      </div>
      {w.upcomingBreak && <p className="mt-2 text-sm text-ink-muted">{w.upcomingBreak} — already in your plan.</p>}
    </section>
  );
}
