import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { PageQueryState } from './page-queries';

// The REAL /r and /m pages, rendered with fixture data (tests/page-queries.ts) instead of the
// database: which blocks show for which state, and that the page wiring (cursor, ?course=js,
// the unread count in the tab title) holds. Server actions are stubbed — tests/actions.test.ts
// covers them.
const state = vi.hoisted((): { q: PageQueryState } => ({ q: { scenario: 'typical', extraUnread: 0 } }));
vi.mock('@/lib/db/queries', async () => {
  const { pageQueries } = await import('./page-queries');
  const live = () => pageQueries(state.q);
  return {
    loadOverview: () => live().loadOverview(),
    listUpdates: (a: Parameters<ReturnType<typeof pageQueries>['listUpdates']>[0]) => live().listUpdates(a),
    countUnreadUpdates: (c: 'js' | 'react-2023') => live().countUnreadUpdates(c),
    getCoachNotes: (...a: Parameters<ReturnType<typeof pageQueries>['getCoachNotes']>) => live().getCoachNotes(...a),
    getJourneyFeed: (...a: Parameters<ReturnType<typeof pageQueries>['getJourneyFeed']>) => live().getJourneyFeed(...a),
    getCourseSummary: () => live().getCourseSummary(),
    HISTORY_NOTES_MAX: 500,
  };
});
vi.mock('@/lib/actions/log', () => ({ signOffAction: vi.fn(), markUpdatesReadAction: vi.fn() }));
vi.mock('@/lib/actions/message', () => ({ replyToUpdateAction: vi.fn(), sendCoachNoteAction: vi.fn(), markCoachMessagesReadAction: vi.fn() }));

import { createElement, isValidElement, type ReactNode } from 'react';
import CoachPage, { generateMetadata } from '@/app/r/[token]/page';
import StudentPage from '@/app/m/[token]/page';
import { StatsRow } from '@/components/stats-row';
import { FromRahul } from '@/components/student/from-rahul';
import { fixtureInbox, fixtureFeed, fixtureOverview } from '@/lib/fixtures';
import { unreadFromRahul } from '@/lib/journey-view';
import { markCoachMessagesReadAction } from '@/lib/actions/message';

const coach = async (sp: Record<string, string> = {}) => text(await CoachPage({ params: Promise.resolve({ token: 't' }), searchParams: Promise.resolve(sp) }));
const student = async (sp: Record<string, string> = {}) => text(await StudentPage({ searchParams: Promise.resolve(sp) }));
/** visible text, one line (tags dropped, entities decoded) */
const text = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');

beforeEach(() => {
  state.q = { scenario: 'typical', extraUnread: 0 };
  vi.clearAllMocks();
});

/** every element of a (not yet rendered) tree whose type is `type` — the page's own JSX, children included */
function findAll(node: ReactNode, type: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap((n) => findAll(n, type));
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [...(node.type === type ? [node] : []), ...findAll(node.props.children, type)];
}

// v3 (spec B2): Rahul's notes written before React went live (lib/courses.ts REACT_NOTES_FROM) are the
// JS course's — fixtures: "Closures took you…" (Aug, read), "JavaScript: done…" (26 Sep, read) and
// "Rest this weekend…" (Thu 1 Oct 23:30 IST, NEVER SEEN by her).
const JS_NOTES = ['Closures took you', 'JavaScript: done', 'Rest this weekend'];

describe('/r — the coach view', () => {
  it('unread updates on top with their reply boxes, then the note, her numbers, the plan, the history', async () => {
    const t = await coach();
    const order = ['Unread', '2 updates', 'Send Mansi a note', 'Her numbers', 'Last 30 days', 'Plan', 'History', 'JavaScript course history'];
    const at = order.map((s) => t.indexOf(s));
    expect(at.every((i) => i >= 0), `missing: ${order.filter((_, i) => at[i] < 0)}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(t.match(/Mark read/g)).toHaveLength(2); // one per unread card
    expect(t).toContain('Stuck');
    expect(t).toContain('Sent by the player'); // the auto-closed one says how it reached him
    expect(t).toContain('From her player');
    expect(t).toContain('Diwali break');
    expect(t).not.toContain('all caught up');
  });
  it('the tab title carries the unread count', async () => {
    expect((await generateMetadata()).title).toBe('(2) Mansi');
    state.q = { scenario: 'behind', extraUnread: 0 };
    expect((await generateMetadata()).title).toBe('Mansi');
  });
  it('nothing unread and she has gone quiet → one line that says so, and a way to write to her (not "all caught up")', async () => {
    state.q = { scenario: 'behind', extraUnread: 0 };
    const t = await coach();
    expect(t).not.toContain('caught up');
    expect(t).toContain('No update for 9 study days — last Thu 8 Oct');
    expect(t).toContain('Send her a note');
    expect(t.indexOf('Send her a note')).toBeLessThan(t.indexOf('Send Mansi a note'));
  });
  it('?before=<cursor> shows only that older page of the history, with a way back', async () => {
    const next = fixtureInbox('typical').history.nextCursor;
    expect(next).not.toBeNull();
    const t = await coach({ before: next ?? '' });
    expect(t).toContain('← Newest');
    expect(t).not.toContain('Send Mansi a note');
    expect(t).not.toContain('Unread');
  });
  it('a cursor it did not make is the first page, not an error', async () => {
    expect(await coach({ before: 'not-a-cursor' })).toContain('Send Mansi a note');
  });
  it('?course=js is the finished JS course: its numbers and every update, read-only', async () => {
    const t = await coach({ course: 'js' });
    expect(t).toContain('← React');
    expect(t).toContain('JavaScript');
    expect(t).toContain('163h 5m over 68 study days');
    expect(t).toContain('Mapty refactor done');
    expect(t).not.toContain('Reply');
  });
  it('v3: his notes list holds only React-era notes — the JS ones are in the JS history, among her updates by time', async () => {
    const t = await coach();
    expect(t).toContain('Three weeks in and you have not missed a study day');
    for (const n of JS_NOTES) expect(t).not.toContain(n);
    const js = await coach({ course: 'js' });
    const order = ['Rest this weekend', 'JavaScript: done', 'Mapty refactor done', 'Async/await', 'Closures took you'];
    const at = order.map((x) => js.indexOf(x));
    expect(at.every((i) => i >= 0), `missing: ${order.filter((_, i) => at[i] < 0)}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    // his view of his own notes: "You · note", and whether she saw it — the never-seen one says so
    expect(js).toMatch(/You · note · [^·]+· Not seen yet Rest this weekend/);
    expect(js).toMatch(/You · note · [^·]+· Seen JavaScript: done/);
    expect(js).not.toContain('Three weeks in');
  });
});

describe('/m — her view', () => {
  it('Rahul’s words first, then this week, her numbers, her updates, the manual sign-off', async () => {
    const t = await student();
    const order = ['From Rahul', 'This week', 'Today', 'Last 30 days', 'Your updates', 'Studied away from the player?', 'Send to Rahul'];
    const at = order.map((s) => t.indexOf(s));
    expect(at.every((i) => i >= 0), `missing: ${order.filter((_, i) => at[i] < 0)}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(t).toContain(`${fixtureFeed('typical').unreadForStudent} new`);
    expect(t).toContain('On yesterday’s update');
    expect(t).toContain('Finish §12 Effects and Data Fetching by Fri 23 Oct');
    expect(t).toContain('JavaScript — finished Sat 26 Sep');
  });
  it('pace: typical (on schedule) never reads Behind; behind always says by how much — pill and Due stat agree', async () => {
    // (§11 "How React Works Behind the Scenes" is a section title, not a pace)
    const pace = /\b(Behind|Ahead)\b(?! the Scenes)/;
    expect(await student()).not.toMatch(pace);
    expect(await coach()).not.toMatch(pace);
    state.q = { scenario: 'behind', extraUnread: 0 };
    // /r: up to the plan list, whose per-week "Behind" is a week's status (week 2 missed), not the pace
    for (const t of [await student(), (await coach()).split(' Plan ')[0]]) {
      expect(t.match(/Behind by 5 days/g)?.length).toBe(2); // the pill + the Due stat
      expect(t).not.toMatch(/\bBehind\b(?! by \d| the Scenes)/);
    }
  });
  it('Rahul\'s notes sit in "Your updates" too (read or not), so a note seen once is not lost', async () => {
    const t = await student();
    const updates = t.slice(t.indexOf('Your updates'), t.indexOf('Studied away'));
    expect(updates).toContain('Rahul · note');
    expect(updates).toContain('Dinner is on me Friday');
    state.q = { scenario: 'behind', extraUnread: 0 }; // every note read, 4 updates = the whole list
    const behind = await student();
    expect(behind.slice(behind.indexOf('Your updates'), behind.indexOf('Studied away'))).toContain('React starts Monday');
  });
  it('streak 0: the "5 min a day counts" nudge is hers — never on a break day, never on Rahul\'s page', async () => {
    state.q = { scenario: 'behind', extraUnread: 0 };
    expect(await student()).toContain('5 min a day counts');
    expect(await coach()).not.toContain('5 min a day counts');
    state.q = { scenario: 'diwali', extraUnread: 0 };
    const t = await student();
    expect(t).toContain('break days are not study days');
    expect(t).toContain('12 days'); // the study-day streak holds through Diwali
    expect(t).not.toContain('5 min a day counts');
    // a streak already 0 when the break began: still no nudge — it would ask her to study right under
    // "Enjoy it — break days are not study days"
    const zero = { ...fixtureOverview('diwali').stats, streak: 0 };
    expect(text(createElement(StatsRow, { stats: zero, viewer: 'student' }))).not.toContain('5 min a day counts');
    expect(text(createElement(StatsRow, { stats: { ...zero, due: { ...zero.due, onBreak: null } }, viewer: 'student' }))).toContain('5 min a day counts');
  });
  it('the course due date is the Due stat\'s alone — not repeated in This week (/m) or the header (/r)', async () => {
    const t = await student();
    const week = t.slice(t.indexOf('This week'), t.indexOf('Today'));
    expect(week).toContain('Finish §12 Effects and Data Fetching by Fri 23 Oct');
    expect(week).toContain('On track');
    expect(week).not.toMatch(/due|Fri 25 Dec/i);
    expect(t.match(/Fri 25 Dec/g)).toHaveLength(1); // the Due stat
    const r = await coach();
    const header = r.slice(0, r.indexOf('Unread'));
    expect(header).toContain('On track');
    expect(header).not.toMatch(/Due|Fri 25 Dec/);
    expect(r).toContain('due Fri 25 Dec · deadline Fri 1 Jan'); // the plan list still says it, every day
  });
  it('the manual sign-off starts at 0m with "Send to Rahul" disabled — one tap no longer sends an hour', async () => {
    const html = renderToString(await StudentPage({ searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/<output[^>]*>0m<\/output>/);
    expect(html).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>Send to Rahul<\/button>/);
  });
  it('nothing unread → no From Rahul block at all', async () => {
    state.q = { scenario: 'behind', extraUnread: 0 };
    expect(await student()).not.toContain('From Rahul');
  });
  it('on the Diwali break: the break replaces the pace', async () => {
    state.q = { scenario: 'diwali', extraUnread: 0 };
    const t = await student();
    const week = t.slice(t.indexOf('This week'), t.indexOf('Last 30 days'));
    expect(week).toContain('Diwali · back Mon 16 Nov');
    expect(week).not.toMatch(/On track|Behind|Ahead/);
  });
  it('before the start: the start date, and an empty history that says what will appear', async () => {
    state.q = { scenario: 'empty', extraUnread: 0 };
    const t = await student();
    expect(t).toContain('Starts Mon 5 Oct');
    expect(t).toContain('Every time you sign off');
  });
  it('before her first session: one line instead of ~600 px of zeros, an empty chart and "On track"', async () => {
    state.q = { scenario: 'empty', extraUnread: 0 };
    const t = await student();
    expect(t).toContain('Your numbers start with your first session.');
    expect(t).not.toMatch(/Streak|Last 30 days|On track/);
    const r = await coach();
    expect(r).toContain('Her numbers start with her first session.');
    expect(r).not.toMatch(/Streak|Last 30 days|On track/);
  });
  it('home shows her 5 newest updates and "See all"; ?updates=all lists the whole feed page', async () => {
    const home = await student();
    const shown = (t: string) => (t.slice(t.indexOf('Your updates'), t.indexOf('Studied away')).match(/\d+[hm](?: \d+m)? · §|Note only · §/g) ?? []).length;
    expect(home).toContain('See all');
    expect(shown(home)).toBe(5);
    const all = await student({ updates: 'all' });
    expect(all).toContain('← Back');
    expect(all).not.toContain('From Rahul');
    expect(all).not.toContain('Studied away from the player?');
    expect(all).toContain(fixtureFeed('typical', 30).updates.at(-1)?.note?.slice(0, 20) ?? 'First day');
  });
  it('?before=<cursor> shows an older page of her updates, with a way back to the newest', async () => {
    const next = fixtureFeed('typical', 5).nextCursor;
    const t = await student({ before: next ?? '' });
    expect(t).toContain('← Newest');
    expect(t).not.toContain('From Rahul');
  });
});

describe('v3: the JS course\'s notes live behind "JavaScript course history" on /m', () => {
  it('her page and her full list hold only React-era notes; "N new" = exactly what From Rahul shows', async () => {
    for (const scenario of ['typical', 'behind'] as const) {
      state.q = { scenario, extraUnread: 0 };
      for (const t of [await student(), await student({ updates: 'all' })]) {
        for (const n of JS_NOTES) expect(t).not.toContain(n);
      }
    }
    state.q = { scenario: 'typical', extraUnread: 0 };
    const feed = fixtureFeed('typical');
    // the never-seen JS note is not in her React count: the badge and the block agree
    expect(feed.unreadForStudent).toBe(unreadFromRahul(feed).length);
    expect(await student()).toContain(`${unreadFromRahul(feed).length} new`);
  });
  it('a quiet link at the bottom: "JavaScript course history →" (?course=js)', async () => {
    const html = renderToString(await StudentPage({ searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/<a href="\?course=js"[^>]*>JavaScript course history →<\/a>/);
    const t = text(await StudentPage({ searchParams: Promise.resolve({}) }));
    expect(t.indexOf('JavaScript course history')).toBeGreaterThan(t.indexOf('Studied away from the player?'));
  });
  it('?course=js: the JS summary, her JS updates, his JS notes among them by time — read-only, nothing React', async () => {
    const t = await student({ course: 'js' });
    expect(t).toContain('← React');
    expect(t).toContain('163h 5m over 68 study days');
    const order = ['Rest this weekend', 'JavaScript: done', 'Mapty refactor done', 'Async/await', 'Closures took you'];
    const at = order.map((x) => t.indexOf(x));
    expect(at.every((i) => i >= 0), `missing: ${order.filter((_, i) => at[i] < 0)}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(t).toContain('Rahul · note');
    for (const x of ['From Rahul', 'Studied away from the player?', 'Sign off', 'This week', 'Three weeks in', 'Your numbers']) expect(t).not.toContain(x);
  });
  it('?course=js marks NOTHING read: no From Rahul (it marks on sight), no "New" mark that could never clear', async () => {
    const el = await StudentPage({ searchParams: Promise.resolve({ course: 'js' }) });
    expect(findAll(el, FromRahul)).toEqual([]);
    const html = renderToString(el);
    expect(html).not.toContain('from-rahul');
    // the never-seen JS note is shown (not lost) — but as history, without a "New" it could never lose
    expect(text(el)).toContain('Rest this weekend');
    expect(text(el)).not.toMatch(/\bNew\b/);
    expect(markCoachMessagesReadAction).not.toHaveBeenCalled();
    // (her React page does mark — From Rahul is there, so the check above is not vacuous)
    expect(findAll(await StudentPage({ searchParams: Promise.resolve({}) }), FromRahul)).toHaveLength(1);
  });
});
