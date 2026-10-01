import { describe, it, expect, vi, beforeAll } from 'vitest';
import { parseJourneySession, parseProgressSnapshot, type JourneySession, type ProgressSnapshot } from '@/lib/player';
import { assembleFeed, type MessageRow, type UpdateRow } from '@/lib/feed';
import { unreadFromRahul } from '@/lib/journey-view';

// Adversarial correctness/security review of the v2 data layer (2026-10-01). Each test pins a
// finding; it FAILS until the finding is fixed. SQL is built with drizzle .toSQL() — the URL
// below is a dummy, no connection is ever opened (same trick as tests/queries-sql.test.ts).
vi.mock('server-only', () => ({}));
let q: typeof import('@/lib/db/queries');
beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/never-connected';
  q = await import('@/lib/db/queries');
});

const SNAPSHOT: ProgressSnapshot = {
  course: 'react-2023',
  takenAt: Date.parse('2026-10-05T06:12:05.000Z'),
  lecturesDone: 58,
  lecturesTotal: 410,
  videoSecondsDone: 31_000,
  videoSecondsTotal: 241_800,
  sectionsDone: [1, 2, 3],
  current: { sectionNumber: 7, lectureNumber: 2, title: 'What is "Thinking in React"?' },
  days: { '2026-10-05': 6120 },
};
const SESSION: JourneySession = {
  id: '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d',
  course: 'react-2023',
  startedAt: '2026-10-05T04:30:00.000Z',
  endedAt: '2026-10-05T06:12:00.000Z',
  studyDate: '2026-10-05',
  minutes: 102,
  sectionNumber: 7,
  lecturesCompleted: [],
  finishedSections: [],
  mood: null,
  note: null,
  stuck: false,
  autoClosed: false,
  progress: null,
};

describe('F1 takenAt has no upper bound', () => {
  // isPosInt + Number.isSafeInteger lets 8.64e15 < takenAt <= 2^53-1 through: not a valid JS Date.
  const BEYOND_DATE = 9_000_000_000_000_000;

  it('PUT /progress: a takenAt past the JS Date range is rejected (400), not crashed on', () => {
    expect(new Date(BEYOND_DATE).getTime()).toBeNaN(); // the premise
    expect(parseProgressSnapshot({ ...SNAPSHOT, takenAt: BEYOND_DATE }).ok).toBe(false);
  });

  it('the accepted snapshot crashes the upsert while building the query (RangeError → route 500 → outbox retries forever)', () => {
    const p = parseProgressSnapshot({ ...SNAPSHOT, takenAt: BEYOND_DATE });
    if (!p.ok) return; // fixed at the validator
    expect(() => q.upsertSnapshotQuery(p.snapshot).toSQL()).not.toThrow();
  });

  it('POST /sessions: such a progress is IGNORED (decision 3), so her update is still stored', () => {
    const r = parseJourneySession({ ...SESSION, progress: { ...SNAPSHOT, takenAt: BEYOND_DATE } });
    expect(r.ok).toBe(true);
    // today: progressIgnored null + progress kept → insertPlayerLog's batch throws → 500 → the
    // SESSION (her minutes + note) is never stored and the outbox retries it forever
    if (r.ok) expect(r.progressIgnored).not.toBeNull();
  });

  it('a snapshot from far in the future (her Mac clock wrong) is refused — "newest wins" would lock every honest snapshot out', () => {
    // setWhere updated_at < excluded.updated_at: once a 2100 row is stored, every later real snapshot answers "stale"
    expect(parseProgressSnapshot({ ...SNAPSHOT, takenAt: Date.parse('2100-01-01T00:00:00Z') }).ok).toBe(false);
  });
});

describe('F2 "From Rahul" drops replies on updates outside the first feed page', () => {
  const LOG = (n: number): UpdateRow => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    externalId: null, source: 'manual', studyDate: '2026-10-05',
    createdAt: new Date(Date.UTC(2026, 9, 5, 12, 0, 59 - n)), // n = 0 is the newest
    cursorKey: `2026-10-05T12:00:${String(59 - n).padStart(2, '0')}.000000Z`,
    minutes: 60, sectionNumber: 7, sectionTitle: 'Thinking In React', lecturesCompleted: null,
    mood: null, note: `update ${n}`, stuck: false, autoClosed: false, coachReadAt: new Date(),
  });

  it('a reply Rahul wrote from his history on her 31st-newest update reaches her block', () => {
    const limit = 30; // FEED_LIMIT on /m and the player's default page
    const rows = Array.from({ length: limit + 1 }, (_, n) => LOG(n)); // what updatesPageQuery returns
    const old = rows[limit]; // the "is there more" row: NOT shown on page 1
    const reply: MessageRow = {
      id: '11111111-0000-4000-8000-000000000001', body: 'Late answer to your question',
      createdAt: new Date(), studentReadAt: null, logEntryId: old.id,
    };
    // unreadForStudent is a SQL count over ALL coach messages, so it says 1 — and since the fix the
    // first page also carries the updates with an unread reply (getJourneyFeed → assembleFeed)
    const feed = assembleFeed({ rows, replies: [], unreadForStudent: 1, first: { notes: [], unreadReplyRows: [old], unreadReplyReplies: [reply] } }, limit);
    // so "From Rahul" (built from page 1) can show it and mark it read
    expect(unreadFromRahul(feed).map((i) => i.message.id)).toEqual([reply.id]);
  });
});
