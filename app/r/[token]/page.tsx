import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { countUnreadUpdates, getCoachNotes, getCourseSummary, listUpdates, loadOverview } from '@/lib/db/queries';
import { ACTIVE_COURSE, getCourse } from '@/lib/courses';
import { TIME_ZONE } from '@/lib/config';
import { todayInTZ } from '@/lib/date';
import { decodeCursor, type FeedCursor } from '@/lib/feed';
import { fmtDate, fmtDur, fmtWhen, plural } from '@/lib/format';
import { caughtUp, planRows, weekView } from '@/lib/journey-view';
import { hasNumbers, type Overview } from '@/lib/overview';
import { COLUMN, PacePill } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { StatsRow } from '@/components/stats-row';
import { ThirtyDays } from '@/components/thirty-days';
import { Pager, UpdateItem } from '@/components/update-item';
import { UnreadUpdates } from '@/components/coach/unread-updates';
import { NoteComposer } from '@/components/coach/note-composer';
import { HistoryReply } from '@/components/coach/history-reply';
import { PlanList } from '@/components/coach/plan-list';

export const dynamic = 'force-dynamic';

// Rahul's view (docs/spec-v2-coaching.md in course-player, §B "Coach view"): her unread updates on
// top, each with its own reply box → a note to her → the stats she sees → the plan → the history
// (read updates + his replies, keyset pages via ?before=<cursor>). The finished JS course is history
// behind a quiet link (?course=js). Data: docs/v2-data-layer.md. Coach actions take FeedUpdate.logId.

const UNREAD_LIMIT = 30;
const HISTORY_LIMIT = 10;

type Props = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** "?before=" from the URL; a cursor this app did not make is treated as the first page */
function cursorFrom(sp: Record<string, string | string[] | undefined>): FeedCursor | null {
  return typeof sp.before === 'string' ? decodeCursor(sp.before) : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const unread = await countUnreadUpdates(ACTIVE_COURSE);
  return { title: unread > 0 ? `(${unread}) Mansi` : 'Mansi' };
}

export default async function CoachPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cursor = cursorFrom(sp);
  if (sp.course === 'js') return jsHistory(cursor);

  const course = ACTIVE_COURSE;
  if (cursor) {
    // an older page of the history: just the list (the rest of the page is about now)
    const [overview, history] = await Promise.all([loadOverview(course), listUpdates({ course, filter: 'read', cursor, limit: HISTORY_LIMIT })]);
    return (
      <Shell overview={overview}>
        <History updates={history.updates} nextCursor={history.nextCursor} today={overview.today} newest />
      </Shell>
    );
  }

  const [overview, unread, history, notes] = await Promise.all([
    loadOverview(course),
    listUpdates({ course, filter: 'unread', cursor: null, limit: UNREAD_LIMIT }),
    listUpdates({ course, filter: 'read', cursor: null, limit: HISTORY_LIMIT }),
    getCoachNotes(),
  ]);
  const { today, stats, status } = overview;
  const newest = unread.updates[0] ?? history.updates[0] ?? null;

  return (
    <Shell overview={overview}>
      <UnreadUpdates updates={unread.updates} today={today} quiet={caughtUp({ last: newest, today, config: overview.config })} more={unread.nextCursor !== null} />

      <div className="mt-12">
        <NoteComposer notes={notes.map((n) => ({ id: n.id, body: n.body, when: fmtWhen(n.createdAt, today), seen: n.readAt !== null }))} />
      </div>

      <section aria-labelledby="stats-title" className="mt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="stats-title" className="text-base font-semibold text-ink">Her numbers</h2>
          {hasNumbers(overview) && (
            <p className="text-sm text-ink-muted">
              {stats.source === 'snapshot' && stats.asOf
                ? `From her player · ${fmtWhen(stats.asOf, today)}`
                : 'From her updates — exact once the player sends its numbers'}
            </p>
          )}
        </div>
        {hasNumbers(overview) ? (
          <>
            <div className="mt-4">
              <StatsRow stats={stats} viewer="coach" />
            </div>
            {stats.current && (
              <p className="mt-4 text-sm text-ink-muted">
                Up next in the player: <span className="text-ink">§{String(stats.current.sectionNumber).padStart(2, '0')} · lecture {stats.current.lectureNumber} — {stats.current.title}</span>
              </p>
            )}
            <div className="mt-10">
              <ThirtyDays days={stats.last30.days} averageSeconds={stats.last30.averageSeconds} today={today} emptyText="Her study time will show up here, day by day." />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">Her numbers start with her first session.</p>
        )}
      </section>

      <div className="mt-16">
        <PlanList rows={planRows(overview)} meta={`${status.totalWeeks} study weeks · due ${fmtDate(status.targetDate)} · deadline ${fmtDate(status.deadline)}`} />
      </div>

      <div className="mt-16">
        <History updates={history.updates} nextCursor={history.nextCursor} today={today} />
      </div>

      <footer className="mt-16 border-t border-line pt-6">
        <a href="?course=js" className="rounded-sm text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">JavaScript course history →</a>
      </footer>
    </Shell>
  );
}

// The header: week, pace (or the break / start date) — no course due date, the plan list's line and the
// Due stat carry it (weekView has none since 2026-10-01; it read twice on one screen).
function Shell({ overview, children }: { overview: Overview; children: ReactNode }) {
  const w = weekView(overview);
  return (
    <main className={`${COLUMN} pb-24`}>
      <header className="flex items-start justify-between gap-4 pt-8 pb-10 sm:pt-12">
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">React · {w.week}</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Mansi</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {w.pace && <PacePill {...w.pace} />}
            {w.onBreak && <PacePill label={`${w.onBreak.label} · back ${w.onBreak.back}`} tone="good" />}
            {w.startsOn && <p className="text-sm text-ink-muted">Starts <span className="font-medium text-ink">{w.startsOn}</span></p>}
          </div>
        </div>
        <ThemeToggle />
      </header>
      {children}
    </main>
  );
}

function History({ updates, nextCursor, today, newest = false, readOnly = false, query = '' }: {
  updates: Awaited<ReturnType<typeof listUpdates>>['updates'];
  nextCursor: string | null;
  today: string;
  /** an older page: link back to the newest */
  newest?: boolean;
  /** the JS course: no replies any more */
  readOnly?: boolean;
  /** kept on the pager links (?course=js) */
  query?: string;
}) {
  return (
    <section aria-labelledby="history-title">
      <div className="border-b border-line pb-4">
        <h2 id="history-title" className="text-base font-semibold text-ink">{readOnly ? 'Her updates' : 'History'}</h2>
      </div>
      {updates.length === 0 ? (
        <p className="py-6 text-sm text-ink-muted">{readOnly ? 'No updates were logged for this course.' : 'Updates you have read land here, with your replies.'}</p>
      ) : (
        updates.map((u) => (
          <UpdateItem key={u.logId} update={u} today={today} viewer="coach" tags={!readOnly}>
            {!readOnly && <HistoryReply logId={u.logId} />}
          </UpdateItem>
        ))
      )}
      <Pager nextHref={nextCursor ? `?${query}before=${nextCursor}` : null} newestHref={newest ? `?${query.replace(/&$/, '')}` : null} />
    </section>
  );
}

// The finished JavaScript course, kept as history: what it took, and every update she sent.
// Awaited by the page (not rendered as an async component), like the page's own reads.
async function jsHistory(cursor: FeedCursor | null) {
  const js = getCourse('js');
  const [summary, updates] = await Promise.all([getCourseSummary('js'), listUpdates({ course: 'js', filter: 'all', cursor, limit: 20 })]);
  const today = todayInTZ(TIME_ZONE);
  return (
    <main className={`${COLUMN} pb-24`}>
      <header className="flex items-start justify-between gap-4 pt-8 pb-10 sm:pt-12">
        <div className="min-w-0">
          <a href="?" className="rounded-sm text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">← React</a>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{js.shortTitle}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Finished{summary.firstDate && summary.lastDate ? ` · ${fmtDate(summary.firstDate)} → ${fmtDate(summary.lastDate)}` : ''} · {fmtDur(summary.minutes)} over {plural(summary.studyDays, 'study day')} · {plural(summary.sessions, 'update')}
          </p>
        </div>
        <ThemeToggle />
      </header>
      <History updates={updates.updates} nextCursor={updates.nextCursor} today={today} newest={cursor !== null} readOnly query="course=js&" />
    </main>
  );
}
