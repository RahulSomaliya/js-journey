import type { PlanRow } from '@/lib/journey-view';
import { breakStudyDays } from '@/lib/schedule';
import { fmtDate, fmtShortDate } from '@/lib/format';
import { CalendarIcon, CheckIcon, SectionHeading } from '@/components/ui';

// The plan, week by week (lib/journey-view.ts planRows): each week's goal, its Friday, and whether
// she met it — plus the break where it falls. Status never by colour alone: ✓ / "This week" /
// "Behind" are words or marks.
type WeekRow = Extract<PlanRow, { kind: 'week' }>;

export function PlanList({ rows, meta }: { rows: PlanRow[]; meta: string }) {
  return (
    <section aria-labelledby="plan-title">
      <SectionHeading id="plan-title" title="Plan" meta={meta} />
      <ol className="mt-4 divide-y divide-line border-y border-line">
        {rows.map((r) => (r.kind === 'week' ? <Week key={`w${r.week}`} row={r} /> : <Break key={`b${r.start}`} row={r} />))}
      </ol>
    </section>
  );
}

function Week({ row }: { row: WeekRow }) {
  const quiet = row.state === 'upcoming' || row.state === 'past';
  return (
    <li className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-x-3 py-3">
      <Mark state={row.state} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          Week {row.week}
          {row.state === 'current' && <span className="ml-2 font-medium text-accent-ink">This week</span>}
          {row.state === 'behind' && <span className="ml-2 font-medium text-ink-muted">Behind</span>}
          {row.state === 'done' && <span className="sr-only"> — done</span>}
        </p>
        <p className={`mt-0.5 text-sm ${quiet ? 'text-ink-subtle' : 'text-ink-muted'}`}>{row.goal}</p>
      </div>
      <p className={`text-sm tabular-nums ${quiet ? 'text-ink-subtle' : 'text-ink-muted'}`}>{fmtDate(row.due)}</p>
    </li>
  );
}

function Mark({ state }: { state: WeekRow['state'] }) {
  if (state === 'done') return <CheckIcon className="mt-0.5 size-4 text-accent" strokeWidth={2} />;
  if (state === 'current') return <span aria-hidden="true" className="mt-1.5 ml-1 block size-2 rounded-full bg-accent" />;
  return <span aria-hidden="true" className="mt-1 ml-0.5 block size-3 rounded-full border border-line" />;
}

function Break({ row }: { row: Extract<PlanRow, { kind: 'break' }> }) {
  return (
    <li className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-x-3 py-3">
      <CalendarIcon className="mt-0.5 size-4 text-ink-muted" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {row.label} break
          {row.now && <span className="ml-2 font-medium text-accent-ink">Now</span>}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted">{breakStudyDays(row)} study days off — every date here already skips them.</p>
      </div>
      <p className="text-sm tabular-nums text-ink-muted">{fmtShortDate(row.start)} – {fmtShortDate(row.end)}</p>
    </li>
  );
}
