import { describe, it, expect } from 'vitest';
import {
  assembleFeed, assemblePage, decodeCursor, encodeCursor, parseFeedQuery, toStudentUpdate, FEED_LIMIT_DEFAULT,
  type MessageRow, type UpdateRow,
} from '@/lib/feed';

const LOG = (n: number, patch: Partial<UpdateRow> = {}): UpdateRow => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  externalId: null,
  source: 'manual',
  studyDate: '2026-10-05',
  createdAt: new Date(Date.UTC(2026, 9, 5, 12, 0, n)),
  cursorKey: `2026-10-05T12:00:${String(n).padStart(2, '0')}.123456Z`,
  minutes: 60,
  sectionNumber: 7,
  sectionTitle: 'Thinking In React - State Management',
  lecturesCompleted: null,
  mood: null,
  note: null,
  stuck: false,
  autoClosed: false,
  coachReadAt: null,
  ...patch,
});
const MSG = (n: number, logEntryId: string | null, patch: Partial<MessageRow> = {}): MessageRow => ({
  id: `11111111-0000-4000-8000-${String(n).padStart(12, '0')}`,
  body: `reply ${n}`,
  createdAt: new Date(Date.UTC(2026, 9, 5, 13, 0, n)),
  studentReadAt: null,
  logEntryId,
  ...patch,
});

describe('feed cursor', () => {
  const c = { createdAt: '2026-10-05T12:00:03.123456Z', id: '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d' };
  it('round-trips and is opaque (url-safe, no raw timestamp)', () => {
    const s = encodeCursor(c);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(s).not.toContain('2026');
    expect(decodeCursor(s)).toEqual(c);
  });
  it('keeps microseconds — a JS Date (ms) would skip or repeat rows that share a millisecond', () => {
    expect(decodeCursor(encodeCursor(c))?.createdAt).toBe('2026-10-05T12:00:03.123456Z');
  });
  it('rejects anything it did not make', () => {
    for (const bad of ['', 'nope', 'abcde', encodeCursor({ ...c, id: 'x' }), encodeCursor({ ...c, createdAt: '2026-10-05' }), 'a'.repeat(500)]) {
      expect(decodeCursor(bad)).toBeNull();
    }
  });
});

describe('assemblePage', () => {
  it('limit+1 rows → a page of `limit` and a cursor at the last row shown', () => {
    const rows = [LOG(5), LOG(4), LOG(3)];
    const page = assemblePage(rows, [], 2);
    expect(page.updates.map((u) => u.logId)).toEqual([LOG(5).id, LOG(4).id]);
    expect(decodeCursor(page.nextCursor ?? '')).toEqual({ createdAt: LOG(4).cursorKey, id: LOG(4).id });
  });
  it('the last page (≤ limit rows) has no cursor', () => {
    expect(assemblePage([LOG(2), LOG(1)], [], 2).nextCursor).toBeNull();
    expect(assemblePage([], [], 30)).toEqual({ updates: [], nextCursor: null });
  });
  it('threads replies under their update, oldest first, and leaves notes out', () => {
    const page = assemblePage([LOG(2), LOG(1)], [MSG(9, LOG(1).id), MSG(3, LOG(1).id), MSG(4, null)], 30);
    expect(page.updates[0].replies).toEqual([]);
    expect(page.updates[1].replies.map((r) => r.body)).toEqual(['reply 3', 'reply 9']);
  });
  it('maps a player row: id = the session id, lectures, flags, read markers as ISO', () => {
    const row = LOG(1, {
      source: 'player', externalId: '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d', mood: '🙂', note: 'useEffect cleanup confused me', stuck: true,
      autoClosed: true, coachReadAt: new Date('2026-10-05T15:00:00.000Z'),
      lecturesCompleted: [{ section: 7, lecture: 3, title: 'Lifting State Up' }],
    });
    const [u] = assemblePage([row], [MSG(1, row.id, { studentReadAt: new Date('2026-10-06T03:00:00.000Z') })], 30).updates;
    expect(u).toEqual({
      id: '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d',
      logId: row.id,
      source: 'player',
      studyDate: '2026-10-05',
      createdAt: '2026-10-05T12:00:01.000Z',
      minutes: 60,
      sectionNumber: 7,
      sectionTitle: 'Thinking In React - State Management',
      lectures: [{ section: 7, lecture: 3, title: 'Lifting State Up' }],
      mood: '🙂',
      note: 'useEffect cleanup confused me',
      stuck: true,
      autoClosed: true,
      coachReadAt: '2026-10-05T15:00:00.000Z',
      replies: [{ id: MSG(1, null).id, body: 'reply 1', createdAt: '2026-10-05T13:00:01.000Z', readAt: '2026-10-06T03:00:00.000Z' }],
    });
  });
  it('a manual row is identified by its own row id and has no lectures', () => {
    const [u] = assemblePage([LOG(1, { lecturesCompleted: null })], [], 30).updates;
    expect([u.id, u.lectures]).toEqual([LOG(1).id, []]);
  });
});

describe('assembleFeed (GET /api/player/feed, her /m page)', () => {
  // 3 updates on a page of 2 (+1 "more" row); LOG(1) is outside the page and Rahul replied to it from
  // his history. Before the fix "From Rahul" was built from the page only: the reply was never shown
  // or marked read, while unreadForStudent (a count over ALL coach messages) kept saying 1.
  const rows = [LOG(3), LOG(2), LOG(1)];
  const oldReply = MSG(7, LOG(1).id);
  const first = { notes: [MSG(8, null)], unreadReplyRows: [LOG(2), LOG(1)], unreadReplyReplies: [MSG(6, LOG(2).id), oldReply, MSG(5, LOG(1).id, { studentReadAt: new Date() })] };
  it('first page: the updates, the notes, and every OLDER update that carries a reply she has not seen', () => {
    const feed = assembleFeed({ rows, replies: [MSG(6, LOG(2).id)], unreadForStudent: 3, first }, 2);
    expect(feed.updates.map((u) => u.id)).toEqual([LOG(3).id, LOG(2).id]);
    expect(feed.notes.map((n) => n.id)).toEqual([MSG(8, null).id]);
    // LOG(2) is already on the page → not repeated; LOG(1) comes with ALL its replies threaded
    expect(feed.unreadReplies?.map((u) => u.id)).toEqual([LOG(1).id]);
    expect(feed.unreadReplies?.[0].replies.map((r) => r.body)).toEqual(['reply 5', 'reply 7']);
    expect(Object.keys(feed.unreadReplies?.[0] ?? {})).not.toContain('logId'); // the contract shape
    expect([feed.unreadForStudent, feed.nextCursor !== null]).toEqual([3, true]);
  });
  it('later pages carry no notes and no unreadReplies (they ride on the first page only)', () => {
    const feed = assembleFeed({ rows: [LOG(1)], replies: [oldReply], unreadForStudent: 1, first: null }, 2);
    expect([feed.notes, feed.unreadReplies, feed.nextCursor]).toEqual([[], [], null]);
  });
});

describe('toStudentUpdate', () => {
  it('strips the coach-only fields — the API returns the exact contract shape', () => {
    const [u] = assemblePage([LOG(1)], [], 30).updates;
    const s = toStudentUpdate(u);
    expect(Object.keys(s).sort()).toEqual(
      ['coachReadAt', 'createdAt', 'id', 'lectures', 'minutes', 'mood', 'note', 'replies', 'sectionNumber', 'sectionTitle', 'source', 'stuck', 'studyDate'],
    );
  });
});

describe('parseFeedQuery', () => {
  const q = (s: string) => parseFeedQuery(new URLSearchParams(s));
  it('defaults: first page of 30', () => {
    expect(q('course=react-2023')).toEqual({ ok: true, course: 'react-2023', cursor: null, limit: FEED_LIMIT_DEFAULT });
    expect(q('course=react-2023&cursor=&limit=')).toEqual({ ok: true, course: 'react-2023', cursor: null, limit: 30 });
  });
  it('reads a cursor and a limit', () => {
    const cursor = encodeCursor({ createdAt: '2026-10-05T12:00:03.123456Z', id: '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d' });
    expect(q(`course=react-2023&cursor=${cursor}&limit=3`)).toMatchObject({ ok: true, limit: 3, cursor: { id: '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d' } });
  });
  it('400 for a missing course, a bad cursor or a limit outside 1..100; 404 for an unknown course', () => {
    expect(q('')).toMatchObject({ ok: false, status: 400 });
    expect(q('course=vue')).toMatchObject({ ok: false, status: 404 });
    expect(q('course=react-2023&cursor=garbage')).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/cursor/) });
    for (const l of ['0', '101', '2.5', 'ten']) expect(q(`course=react-2023&limit=${l}`)).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/limit/) });
  });
});
