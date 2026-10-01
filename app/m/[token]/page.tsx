import type { ReactNode } from 'react';
import { getCourseSummary, getJourneyFeed, loadOverview } from '@/lib/db/queries';
import { ACTIVE_COURSE, COURSE_IDS, getCourse } from '@/lib/courses';
import { hasNumbers } from '@/lib/overview';
import { decodeCursor } from '@/lib/feed';
import { fmtDate, fmtDur, fmtWhen, plural } from '@/lib/format';
import { greeting, replyContext, unreadFromRahul, weekView, withNotes, type HistoryItem } from '@/lib/journey-view';
import { coreSections, finishedSectionIds } from '@/lib/schedule';
import { COLUMN } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { StatsRow } from '@/components/stats-row';
import { ThirtyDays } from '@/components/thirty-days';
import { NoteItem, Pager, UpdateItem } from '@/components/update-item';
import { FromRahul } from '@/components/student/from-rahul';
import { ThisWeek } from '@/components/student/this-week';
import { SignOffForm } from '@/components/student/sign-off-form';

export const dynamic = 'force-dynamic';

// Mansi's page — a phone-friendly mirror of her Course Player home (course-player
// docs/spec-v2-coaching.md §B "Student view"): Rahul's words first (marked read once shown, like the
// player), then this week / due / pace, her numbers, her updates with his replies, and a manual
// sign-off for study away from the player. Warm to her. Data: docs/v2-data-layer.md.

// The feed page she gets is the player's (30). "From Rahul" = that page's unread replies + the feed's
// `unreadReplies` (older updates with an unread reply) + unread notes (lib/journey-view.ts
// unreadFromRahul). Home shows the newest few, his notes among them; "See all" lists the page.
const FEED_LIMIT = 30;
const HOME_UPDATES = 5;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StudentPage({ searchParams }: Props) {
  const sp = await searchParams;
  // a cursor this app did not make → the first page
  const cursor = typeof sp.before === 'string' ? decodeCursor(sp.before) : null;
  const course = ACTIVE_COURSE;

  if (cursor || sp.updates === 'all') {
    // "See all": every update, a feed page at a time (the player's #/updates)
    const [overview, feed] = await Promise.all([loadOverview(course), getJourneyFeed(course, cursor, FEED_LIMIT)]);
    return (
      <Shell title="Your updates" back signOffHref="?#sign-off">
        <YourUpdates
          // his notes ride on the first page only (cursor null); `complete` = no older page to hold the rest
          items={withNotes(feed.updates, feed.notes, feed.nextCursor === null)}
          today={overview.today}
          heading={false}
          nextHref={feed.nextCursor ? `?before=${feed.nextCursor}` : null}
          newestHref={cursor ? '?updates=all' : null}
        />
      </Shell>
    );
  }

  const finished = COURSE_IDS.map(getCourse).filter((c) => c.status === 'completed');
  const [overview, feed, summaries] = await Promise.all([
    loadOverview(course),
    getJourneyFeed(course, null, FEED_LIMIT),
    Promise.all(finished.map((c) => getCourseSummary(c.id))),
  ]);
  const { today, stats } = overview;
  const more = feed.updates.length > HOME_UPDATES || feed.nextCursor !== null;
  const fromRahul = unreadFromRahul(feed).map(({ message, replyTo }) => ({
    id: message.id,
    body: message.body,
    when: fmtWhen(message.createdAt, today),
    context: replyTo ? replyContext(replyTo, today) : null,
  }));
  // what she can still sign off against: the section she is in and everything after it
  const done = finishedSectionIds(overview.logs);
  const sections = coreSections(overview.sections)
    .filter((s) => !done.has(s.id))
    .map((s) => ({ id: s.id, number: s.sortOrder, title: s.title }));

  return (
    <Shell title={`${greeting(new Date())}, Mansi`} signOffHref="#sign-off">
      {fromRahul.length > 0 && (
        <div className="mb-12">
          <FromRahul items={fromRahul} />
        </div>
      )}

      <ThisWeek w={weekView(overview)} />

      {hasNumbers(overview) ? (
        <>
          <div className="mt-12">
            <StatsRow stats={stats} viewer="student" />
          </div>
          <div className="mt-10">
            <ThirtyDays days={stats.last30.days} averageSeconds={stats.last30.averageSeconds} today={today} emptyText="Your study time will show up here, day by day." />
          </div>
        </>
      ) : (
        <p className="mt-12 text-sm text-ink-muted">Your numbers start with your first session.</p>
      )}

      <div className="mt-16">
        <YourUpdates
          items={withNotes(feed.updates.slice(0, HOME_UPDATES), feed.notes, !more)}
          today={today}
          seeAll={more}
        />
      </div>

      <section id="sign-off" aria-labelledby="sign-off-title" className="mt-16 scroll-mt-6">
        <h2 id="sign-off-title" className="text-base font-semibold text-ink">Studied away from the player?</h2>
        <p className="mt-1 text-sm text-ink-muted">Sign off here — it reaches Rahul just like a sign-off in the player.</p>
        <div className="mt-4">
          <SignOffForm sections={sections} currentSectionId={overview.currentSection?.id ?? null} />
        </div>
      </section>

      {finished.length > 0 && (
        <footer className="mt-16 space-y-1 border-t border-line pt-6">
          {finished.map((c, i) => {
            const s = summaries[i];
            return (
              <p key={c.id} className="text-sm text-ink-muted">
                {c.shortTitle} — finished{s.lastDate ? ` ${fmtDate(s.lastDate)}` : ''} · {fmtDur(s.minutes)} over {plural(s.studyDays, 'day')}. Everything in React stands on it.
              </p>
            );
          })}
        </footer>
      )}
    </Shell>
  );
}

function Shell({ title, back = false, signOffHref, children }: { title: string; back?: boolean; signOffHref: string; children: ReactNode }) {
  return (
    <main className={`${COLUMN} pb-24`}>
      <header className="flex items-start justify-between gap-4 pt-8 pb-10 sm:pt-12">
        <div className="min-w-0">
          {back ? (
            <a href="?" className="rounded-sm text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">← Back</a>
          ) : (
            <p className="text-sm text-ink-muted">React</p>
          )}
          <h1 className="mt-1 text-3xl font-semibold text-ink">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <a href={signOffHref} className="inline-flex h-8 items-center rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink hover:bg-fill">
            Sign off
          </a>
          <ThemeToggle />
        </div>
      </header>
      {children}
    </main>
  );
}

function YourUpdates({ items, today, heading = true, seeAll = false, nextHref = null, newestHref = null }: {
  /** her updates with Rahul's notes among them (withNotes) */
  items: HistoryItem[];
  today: string;
  /** false when the page title already says "Your updates" */
  heading?: boolean;
  /** home: link to the full list */
  seeAll?: boolean;
  nextHref?: string | null;
  newestHref?: string | null;
}) {
  return (
    <section aria-labelledby="updates-title">
      <div className={`flex items-baseline justify-between gap-4 border-b border-line ${heading ? 'pb-4' : ''}`}>
        <h2 id="updates-title" className={heading ? 'text-base font-semibold text-ink' : 'sr-only'}>Your updates</h2>
        {seeAll && <a href="?updates=all" className="rounded-sm text-sm font-medium text-accent-ink underline-offset-4 hover:underline">See all</a>}
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-sm text-ink-muted">Every time you sign off — in the player or below — your update shows up here, with Rahul’s replies.</p>
      ) : (
        items.map((i) => (i.kind === 'update'
          ? <UpdateItem key={i.update.id} update={i.update} today={today} viewer="student" />
          : <NoteItem key={i.note.id} note={i.note} today={today} />))
      )}
      <Pager nextHref={nextHref} newestHref={newestHref} />
    </section>
  );
}
