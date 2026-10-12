import type { JourneyStats } from '@/lib/stats';
import { fmtDate, fmtSeconds, plural } from '@/lib/format';
import { paceLabel } from '@/lib/journey-view';
import { GoalCheck } from '@/components/ui';

// The Course Player's home row, mirrored: Today · Streak · Complete · Due — a quiet row, no cards,
// hairline dividers (course-player screens/home/Stats.tsx). Same numbers she sees (lib/stats.ts).
// Due's word is the pace pill's own label (paceLabel): a separate word map once printed a bare "Behind".

// `viewer`: the streak-0 nudge "5 min a day counts" (how a 0 streak starts again) is worded to HER —
// not on Rahul's /r, and not on a plan-break day: it would ask her to study right under "break days are
// not study days". (The study-day streak holds through a break; it is 0 there only if she missed the
// last study day before it.) Mirror: course-player screens/home/Stats.tsx.
export function StatsRow({ stats, viewer }: { stats: JourneyStats; viewer: 'coach' | 'student' }) {
  const { complete, due } = stats;
  const nudge = viewer === 'student' && stats.streak === 0 && due.onBreak === null;
  return (
    <dl className="grid grid-cols-2 gap-y-6 border-y border-line py-6 sm:grid-cols-4 sm:gap-y-0">
      {/* v4: a day at or over the plan's daily goal gets a small accent ✓ and these words; a short day gets nothing */}
      <Stat label="Today" value={fmtSeconds(stats.today.seconds)} met={stats.today.met} />
      <Stat label="Streak" value={plural(stats.streak, 'day')} hint={nudge ? '5 min a day counts' : undefined} />
      <Stat
        label="Complete"
        value={complete.label}
        // without a player snapshot only finished sections are known, not the lecture total
        hint={complete.lecturesTotal === null ? plural(complete.lecturesDone, 'lecture') : `${complete.lecturesDone} / ${complete.lecturesTotal} lectures`}
      />
      <Stat label="Due" value={fmtDate(due.date)} hint={due.onBreak ? `${due.onBreak.label} break` : due.pace ? paceLabel(due).label : undefined} />
    </dl>
  );
}

function Stat({ label, value, hint, met = false }: { label: string; value: string; hint?: string; met?: boolean }) {
  return (
    <div className="px-1 sm:border-l sm:border-line sm:px-5 sm:first:border-l-0 sm:first:pl-1">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-ink">
        {value}
        {met && <GoalCheck className="size-4" />}
      </dd>
      {met && <dd className="mt-1 text-sm text-accent-ink">Daily goal met</dd>}
      {hint && <dd className="mt-1 text-sm text-ink-subtle">{hint}</dd>}
    </div>
  );
}
