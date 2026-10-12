'use client';
import { useState } from 'react';
import type { PlanRow } from '@/lib/journey-view';
import type { OutlineGroup, OutlineSectionRow, WeekOutline } from '@/lib/outline';
import { breakStudyDays } from '@/lib/schedule';
import { fmtDate, fmtSeconds, fmtShortDate, plural, sectionTag } from '@/lib/format';
import { CalendarIcon, CheckIcon, ChevronDownIcon, LectureMark, QuietCheck, SectionHeading } from '@/components/ui';
import { Collapse } from '@/components/collapse';

// The plan, week by week (lib/journey-view.ts planRows): each week's goal, its Friday, and whether
// she met it — plus the break where it falls. Status never by colour alone: ✓ / "This week" /
// "Behind" are words or marks.
// v4: every week is a button that opens what is under it — Part → section → lecture, the view she has on
// her home (course-player CourseContent.tsx, same look in these tokens). ONE week open at a time. The
// outlines are computed on the SERVER (lib/outline.ts weekOutline) and passed in: importing the outline
// here would ship its 37 KB JSON to the browser. `outlines` null = a course without one: plain rows.
type WeekRow = Extract<PlanRow, { kind: 'week' }>;
type Outlines = Record<number, WeekOutline>;

/** the section a week opens with: the one holding "Continue", else none */
const currentSectionOf = (o: WeekOutline | undefined): number[] => {
  const cur = o?.groups.flatMap((g) => g.sections).find((s) => s.current);
  return cur ? [cur.number] : [];
};

export function PlanList({ rows, meta, outlines }: { rows: PlanRow[]; meta: string; outlines: Outlines | null }) {
  const currentWeek = rows.find((r): r is WeekRow => r.kind === 'week' && r.state === 'current')?.week ?? null;
  const [openWeek, setOpenWeek] = useState<number | null>(outlines && currentWeek !== null ? currentWeek : null);
  const [openSections, setOpenSections] = useState<ReadonlySet<number>>(() => new Set(currentWeek !== null ? currentSectionOf(outlines?.[currentWeek]) : []));

  function toggleWeek(week: number) {
    if (openWeek === week) {
      setOpenWeek(null);
      return;
    }
    setOpenWeek(week);
    setOpenSections(new Set(currentSectionOf(outlines?.[week])));
  }
  function toggleSection(n: number) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  return (
    <section aria-labelledby="plan-title">
      <SectionHeading id="plan-title" title="Plan" meta={meta} />
      <ol className="mt-4 divide-y divide-line border-y border-line">
        {rows.map((r) =>
          r.kind === 'week' ? (
            <Week key={`w${r.week}`} row={r} outline={outlines?.[r.week] ?? null} open={openWeek === r.week} onToggle={() => toggleWeek(r.week)} openSections={openSections} onToggleSection={toggleSection} />
          ) : (
            <Break key={`b${r.start}`} row={r} />
          ),
        )}
      </ol>
    </section>
  );
}

function Week({ row, outline, open, onToggle, openSections, onToggleSection }: {
  row: WeekRow;
  outline: WeekOutline | null;
  open: boolean;
  onToggle: () => void;
  openSections: ReadonlySet<number>;
  onToggleSection: (n: number) => void;
}) {
  const quiet = row.state === 'upcoming' || row.state === 'past';
  const head = (
    <>
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
    </>
  );
  if (!outline) return <li className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-x-3 py-3">{head}</li>;

  const panel = `week-${row.week}`;
  return (
    <li data-week={row.week} className="inset-focus">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className="group grid w-full grid-cols-[1.25rem_1fr_auto_1rem] items-start gap-x-3 rounded-md py-3 text-left hover:bg-fill"
      >
        {head}
        <ChevronDownIcon className={`mt-0.5 size-4 text-ink-subtle transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`} />
      </button>
      <Collapse open={open} id={panel}>
        <div className="pb-4 pl-8">
          {outline.groups.length === 0 ? (
            <p className="py-1 text-sm text-ink-subtle">No lectures listed for this week.</p>
          ) : (
            outline.groups.map((g) => <Group key={g.part?.number ?? 'start'} group={g} openSections={openSections} onToggleSection={onToggleSection} />)
          )}
        </div>
      </Collapse>
    </li>
  );
}

function Group({ group, openSections, onToggleSection }: { group: OutlineGroup; openSections: ReadonlySet<number>; onToggleSection: (n: number) => void }) {
  const rows = group.sections.map((s) => <SectionRow key={s.number} section={s} nested={group.part !== null} open={openSections.has(s.number)} onToggle={() => onToggleSection(s.number)} />);
  if (!group.part) return <div className="pt-1">{rows}</div>;
  return (
    <section aria-label={`Part ${group.part.number} — ${group.part.title}`} className="pt-4 first:pt-1">
      <p className="px-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Part {group.part.number}</p>
      <h3 className="mt-0.5 px-2 text-[15px] font-semibold text-ink">
        {group.part.title}
        {group.part.projects > 0 && <span className="ml-2 whitespace-nowrap text-sm font-normal text-ink-subtle">{plural(group.part.projects, 'project')}</span>}
      </h3>
      {/* the nested group: a hairline the "she's here" dot sits on */}
      <div className="ml-2 mt-2 border-l border-line pl-3 sm:pl-4">{rows}</div>
    </section>
  );
}

function SectionRow({ section: s, nested, open, onToggle }: { section: OutlineSectionRow; nested: boolean; open: boolean; onToggle: () => void }) {
  const panel = `week-section-${s.number}`;
  return (
    <div data-section={s.number} data-current={s.current ? 'true' : undefined} className="relative">
      {s.current && (
        // centred on the part's 1 px hairline: -(group padding 12/16 px + 0.5 px + half the dot); a loose section
        // (01, before Part 1) has no hairline, the dot sits in the gutter instead
        <span aria-hidden="true" className={`absolute top-[21px] size-2 rounded-full bg-accent ${nested ? '-left-[16.5px] sm:-left-[20.5px]' : '-left-3'}`} />
      )}
      <h4>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={onToggle}
          // items-start + 24 px line boxes: number, ✓ and chevron sit on the FIRST line of a title that wraps
          className="flex w-full items-start gap-3 rounded-md px-2 py-3 text-left leading-6 hover:bg-fill"
        >
          <span className={`w-6 shrink-0 text-sm leading-6 tabular-nums ${s.current ? 'text-accent-ink' : 'text-ink-subtle'}`}>{s.partIntro ? '' : sectionTag(s.number)}</span>
          <span className={`min-w-0 flex-1 text-[15px] leading-6 ${s.current ? 'font-semibold text-ink' : s.skipped ? 'text-ink-subtle' : s.partIntro ? 'text-ink-muted' : 'font-medium text-ink'}`}>
            {s.partIntro ? 'Part introduction' : s.title}
            {s.current && <span className="sr-only"> — she’s here</span>}
          </span>
          {s.skipped && <span className="shrink-0 text-xs font-medium leading-6 text-ink-subtle">Skipped</span>}
          <span className="flex h-6 w-4 shrink-0 items-center justify-center">
            {s.done && (
              <>
                <QuietCheck />
                <span className="sr-only">, done</span>
              </>
            )}
          </span>
          <span className="w-14 shrink-0 text-right text-sm leading-6 tabular-nums text-ink-subtle">{length(s.seconds)}</span>
          <ChevronDownIcon className={`mt-1 size-4 shrink-0 text-ink-subtle transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`} />
        </button>
      </h4>
      <Collapse open={open} id={panel}>
        <ul className="pb-3 pl-7">
          {s.lectures.map((l) => {
            const state = l.done ? 'done' : l.current ? 'current' : 'plain';
            return (
              <li key={l.number} className="flex items-start gap-3 px-2 py-2">
                <span className="pt-px"><LectureMark state={state} /></span>
                {state !== 'plain' && <span className="sr-only">{state === 'done' ? 'done' : 'she’s here'}: </span>}
                <span className={`min-w-0 flex-1 text-sm text-ink ${l.current ? 'font-medium' : ''}`}>
                  <span className="tabular-nums text-ink-subtle">{l.number}.</span> {l.title}
                </span>
                <span className="shrink-0 pt-px text-xs tabular-nums text-ink-subtle">{l.kind === 'video' ? length(l.seconds) : 'Article'}</span>
              </li>
            );
          })}
        </ul>
      </Collapse>
    </div>
  );
}

/** "1h 5m" / "12m" / "<1m" — fmtSeconds rounds down, a 40 s lecture must not read "0m" */
const length = (seconds: number) => (seconds < 60 ? '<1m' : fmtSeconds(seconds));

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
