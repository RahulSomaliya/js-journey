// Fixture-backed stand-ins for the reads the two pages make (lib/db/queries.ts) — no database.
// tests/pages.test.ts renders the REAL /m and /r pages through these, and the QA screenshot harness
// does too, so a page can be built and checked without ever touching production data.
// Not a test file (vitest only collects *.test.ts).
import { fixtureFeed, fixtureNotes, fixtureOverview, fixtureUpdates, type Scenario } from '@/lib/fixtures';
import { encodeCursor, toStudentUpdate, type FeedCursor, type FeedUpdate } from '@/lib/feed';
import { CURRICULUM } from '@/lib/curriculum';
import type { CourseId } from '@/lib/courses';
import type { CourseSummary, UpdatesQuery } from '@/lib/db/queries';
import type { JourneyFeed } from '@/lib/player';

export interface PageQueryState {
  scenario: Scenario;
  /** QA: also treat this many of the newest READ updates as unread ("3 unread" on /r) */
  extraUnread: number;
}

const js = (n: number) => CURRICULUM.find((s) => s.sortOrder === n)?.title ?? null;
// The finished JS course: a few old manual check-ins (v1 moods 🚀😊 — old rows keep them).
const JS_UPDATES: FeedUpdate[] = [
  ['2026-09-26', 20, '🚀', 'Mapty refactor done — the JavaScript course is complete!'],
  ['2026-09-25', 19, '😊', 'Async/await finally reads like normal code to me.'],
  ['2026-09-24', 18, null, null],
].map(([date, n, mood, note], i) => ({
  id: `0000000${i}-0000-4000-8000-00000000000${i}`,
  logId: `0000000${i}-0000-4000-8000-00000000000${i}`,
  source: 'manual',
  studyDate: String(date),
  createdAt: `${date}T15:00:00.000Z`,
  minutes: 150,
  sectionNumber: Number(n),
  sectionTitle: js(Number(n)),
  lectures: [],
  mood: mood === null ? null : String(mood),
  note: note === null ? null : String(note),
  stuck: false,
  autoClosed: false,
  coachReadAt: `${date}T16:00:00.000Z`,
  replies: [],
}));

const cursorOf = (u: FeedUpdate) => encodeCursor({ createdAt: u.createdAt.replace('Z', '000Z'), id: u.logId });

export function pageQueries(state: PageQueryState) {
  const updates = (course: CourseId): FeedUpdate[] => {
    if (course === 'js') return JS_UPDATES;
    let promote = state.extraUnread;
    return fixtureUpdates(state.scenario).map((u) => {
      if (u.coachReadAt === null || promote <= 0) return u;
      promote--;
      return { ...u, coachReadAt: null };
    });
  };
  const page = (list: FeedUpdate[], cursor: FeedCursor | null, limit: number) => {
    const start = cursor ? list.findIndex((u) => u.logId === cursor.id) + 1 : 0;
    const shown = list.slice(start, start + limit);
    const last = shown[shown.length - 1];
    return { updates: shown, nextCursor: last && start + limit < list.length ? cursorOf(last) : null };
  };
  return {
    loadOverview: async () => fixtureOverview(state.scenario),
    listUpdates: async (a: UpdatesQuery) =>
      page(updates(a.course).filter((u) => (a.filter === 'all' ? true : a.filter === 'unread' ? u.coachReadAt === null : u.coachReadAt !== null)), a.cursor, a.limit),
    countUnreadUpdates: async (course: CourseId) => updates(course).filter((u) => u.coachReadAt === null).length,
    getCoachNotes: async () => fixtureNotes(state.scenario),
    getJourneyFeed: async (course: CourseId, cursor: FeedCursor | null, limit: number): Promise<JourneyFeed> => {
      if (cursor === null) return fixtureFeed(state.scenario, limit);
      const p = page(updates(course), cursor, limit);
      return { ...fixtureFeed(state.scenario, limit), updates: p.updates.map(toStudentUpdate), notes: [], unreadReplies: [], nextCursor: p.nextCursor };
    },
    getCourseSummary: async (): Promise<CourseSummary> => ({ minutes: 9785, sessions: 74, studyDays: 68, firstDate: '2026-06-22', lastDate: '2026-09-26' }),
  };
}
