import { REACT_CURRICULUM } from '@/lib/curriculum';
import { REACT_PLAN } from '@/lib/config';
import { finishedSectionIds, type LogEntry } from '@/lib/schedule';
import { buildOverview, type Overview } from '@/lib/overview';
import { assembleFeed, assemblePage, type FeedUpdate, type MessageRow, type UpdateRow } from '@/lib/feed';
import type { CoachMessage, JourneyFeed, ProgressSnapshot } from '@/lib/player';

// Realistic, deterministic data in the EXACT shapes the v2 data layer returns, so the /m and
// /r pages can be built, screenshotted and tested without a database (docs/v2-data-layer.md).
// Built through the real pure code (buildOverview, assemblePage), so a fixture cannot drift
// from what production returns. Never imported by production code paths.
//
//   typical — Wed 21 Oct (week 3), on track; 2 unread updates for Rahul (one stuck, one
//             auto-closed), 1 unread reply + 1 unread note for her, a long note, a note-only day
//   behind  — same day, but she stopped after Thu 8 Oct: behind, streak 0
//   diwali  — Wed 4 Nov, mid-break, on plan through §16
//   empty   — Sat 3 Oct, before the plan starts: nothing at all (empty states)

export type Scenario = 'typical' | 'behind' | 'diwali' | 'empty';

export const FIXTURE_NOW: Record<Scenario, Date> = {
  typical: new Date('2026-10-21T13:30:00.000Z'), // 19:00 IST
  behind: new Date('2026-10-21T13:30:00.000Z'),
  diwali: new Date('2026-11-04T06:30:00.000Z'), // 12:00 IST
  empty: new Date('2026-10-03T06:30:00.000Z'),
};

const uuid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
/** an IST wall-clock time as a Date */
const ist = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`);
const section = (n: number) => {
  const s = REACT_CURRICULUM.find((x) => x.sortOrder === n);
  if (!s) throw new Error(`fixture: no React section ${n}`);
  return s;
};

interface Day {
  date: string; at: string; minutes: number; section: number; finished?: number[]; note?: string; mood?: string;
  stuck?: boolean; autoClosed?: boolean; manual?: boolean; lectures?: number;
}

const LONG_NOTE =
  'useEffect cleanup finally makes sense for the timer example — but I am confused why the fetch effect runs twice in dev. ' +
  'I read that StrictMode mounts, unmounts and mounts again, so is the AbortController the "right" fix or just a workaround? ' +
  'Also: when the dependency array has an object from props, the effect re-runs every render even though nothing changed. ' +
  'I tried useMemo on it and it stopped, but Jonas said not to reach for useMemo early. Which one is the habit I should build? ' +
  'Spent 40 minutes on this before giving up for today 😩';

const TYPICAL_DAYS: Day[] = [
  { date: '2026-10-05', at: '20:10', minutes: 130, section: 3, finished: [1, 2], mood: '😄', note: 'First day of React! Set up Vite, everything worked first time.', lectures: 14 },
  { date: '2026-10-06', at: '19:40', minutes: 150, section: 3, finished: [3], mood: '🙂', note: 'JSX vs createElement clicked after drawing it out.', lectures: 9 },
  { date: '2026-10-07', at: '21:05', minutes: 140, section: 5, mood: '🙂', lectures: 8 },
  { date: '2026-10-08', at: '20:30', minutes: 160, section: 5, finished: [5], mood: '😄', note: 'Pizza menu project done. Props are just function arguments!', lectures: 11 },
  { date: '2026-10-09', at: '18:15', minutes: 90, section: 6, mood: '😐', note: 'Short day, guests at home.', lectures: 4 },
  { date: '2026-10-12', at: '20:00', minutes: 150, section: 6, mood: '🙂', note: 'Steps component: state vs props comparison table helped a lot.', lectures: 9 },
  { date: '2026-10-13', at: '21:20', minutes: 120, section: 6, finished: [6], mood: '😄', note: 'Travel list form done — controlled inputs feel natural now.', lectures: 7 },
  { date: '2026-10-14', at: '22:00', minutes: 0, section: 7, manual: true, mood: '😐', note: 'No laptop today — re-watched the "lifting state up" lecture on my phone and wrote notes on paper.' },
  { date: '2026-10-15', at: '20:45', minutes: 170, section: 7, mood: '🙂', note: 'Derived state: I was storing numItems in state, removed it 👍', lectures: 10 },
  { date: '2026-10-16', at: '19:55', minutes: 130, section: 7, finished: [7], mood: '😄', note: 'Far Away app finished and deployed to Netlify!', lectures: 8 },
  { date: '2026-10-19', at: '20:20', minutes: 140, section: 8, mood: '🙂', note: 'Eat-N-Split: built the friends list without looking at the solution first.', lectures: 6 },
  { date: '2026-10-20', at: '21:10', minutes: 100, section: 8, finished: [8, 9], mood: '😄', note: 'Split-bill form works. Part 2 starts tomorrow!', lectures: 5 },
  { date: '2026-10-21', at: '17:45', minutes: 40, section: 10, autoClosed: true, lectures: 2 },
  { date: '2026-10-21', at: '18:55', minutes: 75, section: 10, stuck: true, mood: '😩', note: LONG_NOTE, lectures: 3 },
];

function diwaliDays(): Day[] {
  const extra: [string, number][] = [
    ['2026-10-22', 10], ['2026-10-23', 11], ['2026-10-26', 12], ['2026-10-27', 13], ['2026-10-28', 14], ['2026-10-29', 15], ['2026-10-30', 16],
  ];
  return [
    ...TYPICAL_DAYS.map((d) => ({ ...d, stuck: false })),
    ...extra.map(([date, n]): Day => ({ date, at: '20:00', minutes: 150, section: n, finished: [n], mood: '🙂', note: `Finished §${n}.`, lectures: 12 })),
  ];
}

function daysFor(s: Scenario): Day[] {
  if (s === 'empty') return [];
  if (s === 'behind') return TYPICAL_DAYS.filter((d) => d.date <= '2026-10-08');
  if (s === 'diwali') return diwaliDays();
  return TYPICAL_DAYS;
}

function rowsFor(s: Scenario): { log: LogEntry; row: UpdateRow }[] {
  return daysFor(s).map((d, i) => {
    const id = uuid('00000000', i + 1);
    const createdAt = ist(d.date, d.at);
    const sec = section(d.section);
    const lectures = Array.from({ length: d.lectures ?? 0 }, (_, k) => ({ section: d.section, lecture: k + 1, title: `${sec.title.split(' - ')[0]} — part ${k + 1}` }));
    const finished = d.finished ?? [];
    const log: LogEntry = {
      id, studyDate: d.date, minutes: d.minutes, sectionId: sec.id, createdAt: createdAt.toISOString(),
      finishedSection: finished.includes(d.section),
      alsoFinishedIds: finished.filter((n) => n !== d.section).map((n) => section(n).id),
      note: d.note ?? null, mood: d.mood ?? null, source: d.manual ? 'manual' : 'player', lecturesCompleted: d.manual ? null : lectures,
    };
    // Rahul has read everything except the two updates from tonight (typical / behind: all read)
    const unreadForCoach = s === 'typical' && d.date === '2026-10-21';
    const row: UpdateRow = {
      id, externalId: d.manual ? null : uuid('5e550000', i + 1), source: log.source ?? 'manual', studyDate: d.date, createdAt,
      cursorKey: createdAt.toISOString().replace('Z', '000Z'), minutes: d.minutes, sectionNumber: sec.sortOrder, sectionTitle: sec.title,
      lecturesCompleted: log.lecturesCompleted ?? null, mood: log.mood ?? null, note: log.note ?? null, stuck: d.stuck ?? false,
      autoClosed: d.autoClosed ?? false, coachReadAt: unreadForCoach ? null : new Date(createdAt.getTime() + 45 * 60_000),
    };
    return { log, row };
  });
}

function repliesFor(s: Scenario, rows: UpdateRow[]): MessageRow[] {
  if (s === 'empty') return [];
  const on = (date: string) => rows.find((r) => r.studyDate === date);
  const reply = (n: number, date: string, body: string, read: boolean): MessageRow[] => {
    const r = on(date);
    if (!r) return [];
    const createdAt = new Date(r.createdAt.getTime() + 40 * 60_000);
    return [{ id: uuid('77777777', n), body, createdAt, logEntryId: r.id, studentReadAt: read ? new Date(createdAt.getTime() + 12 * 3_600_000) : null }];
  };
  return [
    ...reply(1, '2026-10-05', 'What a start! Vite on the first try is not nothing 💚', true),
    ...reply(2, '2026-10-08', 'Exactly — props are arguments, state is memory. You will use that sentence for years.', true),
    ...reply(3, '2026-10-14', 'Paper notes count. Rest days that still touch the material are the best kind.', true),
    ...reply(4, '2026-10-16', 'Deployed! Send me the link, I want to add an item 😄', true),
    ...reply(5, '2026-10-16', 'Also: the derived-state fix from Thursday was a senior move.', true),
    ...reply(6, '2026-10-20', 'Part 2 is where it gets fun. Effects next week — go slow there.', s !== 'typical'),
  ];
}

export function fixtureNotes(s: Scenario): CoachMessage[] {
  if (s === 'empty') return [];
  const notes: CoachMessage[] = [
    { id: uuid('99999999', 1), body: 'React starts Monday. Same rhythm as JS: 2.5 hours, five days, and tell me when something is fuzzy.', createdAt: '2026-10-04T05:00:00.000Z', readAt: '2026-10-04T09:12:00.000Z' },
  ];
  if (s === 'typical') notes.unshift({ id: uuid('99999999', 2), body: 'Three weeks in and you have not missed a study day. Proud of you. Dinner is on me Friday 🍕', createdAt: '2026-10-20T16:30:00.000Z', readAt: null });
  return notes;
}

/** The player's latest snapshot for the scenario (null for empty — the stats fall back to sessions). */
export function fixtureSnapshot(s: Scenario): ProgressSnapshot | null {
  const logs = rowsFor(s).map((x) => x.log);
  if (logs.length === 0) return null;
  const done = finishedSectionIds(logs);
  const totalSeconds = REACT_CURRICULUM.reduce((sum, x) => sum + x.videoMinutes * 60, 0);
  const doneSeconds = REACT_CURRICULUM.filter((x) => done.has(x.id)).reduce((sum, x) => sum + x.videoMinutes * 60, 0);
  const days: Record<string, number> = {};
  for (const l of logs) days[l.studyDate] = (days[l.studyDate] ?? 0) + l.minutes * 60 + (l.minutes ? 37 : 0);
  const last = logs[logs.length - 1];
  const current = REACT_CURRICULUM.find((x) => x.kind === 'core' && !done.has(x.id));
  return {
    course: 'react-2023',
    takenAt: Date.parse(last.createdAt ?? '') + 60_000,
    lecturesDone: Math.round((doneSeconds / totalSeconds) * 410) + 3,
    lecturesTotal: 410,
    videoSecondsDone: doneSeconds + 900,
    videoSecondsTotal: totalSeconds,
    sectionsDone: REACT_CURRICULUM.filter((x) => done.has(x.id)).map((x) => x.sortOrder),
    current: current ? { sectionNumber: current.sortOrder, lectureNumber: 4, title: 'Component Composition and Prop Drilling' } : null,
    days,
  };
}

export function fixtureOverview(s: Scenario): Overview {
  const note = fixtureNotes(s).find((n) => n) ?? null;
  return buildOverview({
    now: FIXTURE_NOW[s], sections: REACT_CURRICULUM, logs: rowsFor(s).map((x) => x.log).reverse(), config: REACT_PLAN,
    coachNote: note ? { body: note.body, createdAt: note.createdAt } : null, snapshot: fixtureSnapshot(s),
  });
}

/** Every update of the scenario, newest first, replies threaded — the coach pages' shape. */
export function fixtureUpdates(s: Scenario): FeedUpdate[] {
  const rows = rowsFor(s).map((x) => x.row).reverse();
  return assemblePage(rows, repliesFor(s, rows), rows.length).updates;
}

/** GET /api/player/feed / her web page: first page (notes + unreadReplies ride on the first page only),
 *  through the same assembleFeed as lib/db/queries.ts getJourneyFeed. */
export function fixtureFeed(s: Scenario, limit = 30): JourneyFeed {
  const rows = rowsFor(s).map((x) => x.row).reverse();
  const replies = repliesFor(s, rows);
  const notes = fixtureNotes(s);
  const unreadForStudent = replies.filter((r) => !r.studentReadAt).length + notes.filter((n) => !n.readAt).length;
  const unreadReplyRows = rows.filter((r) => replies.some((m) => m.logEntryId === r.id && !m.studentReadAt));
  const noteRows: MessageRow[] = notes.map((n) => ({
    id: n.id, body: n.body, createdAt: new Date(n.createdAt), studentReadAt: n.readAt ? new Date(n.readAt) : null, logEntryId: null,
  }));
  return assembleFeed({
    rows: rows.slice(0, limit + 1), replies, unreadForStudent,
    first: { notes: noteRows, unreadReplyRows, unreadReplyReplies: replies },
  }, limit);
}

/** The coach page's lists: unread updates (newest first), read history (first page), notes. */
export function fixtureInbox(s: Scenario, historyLimit = 10): {
  unread: FeedUpdate[]; unreadCount: number; history: { updates: FeedUpdate[]; nextCursor: string | null }; notes: CoachMessage[];
} {
  const rows = rowsFor(s).map((x) => x.row).reverse();
  const replies = repliesFor(s, rows);
  const unreadRows = rows.filter((r) => !r.coachReadAt);
  const unread = assemblePage(unreadRows, replies, unreadRows.length).updates;
  return { unread, unreadCount: unread.length, history: assemblePage(rows.filter((r) => r.coachReadAt), replies, historyLimit), notes: fixtureNotes(s) };
}
