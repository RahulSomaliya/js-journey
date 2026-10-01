import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encodeCursor } from '@/lib/feed';
import type { JourneyFeed } from '@/lib/player';

// GET /api/player/feed, POST /api/player/feed/read, PUT /api/player/progress — thin
// handlers: auth → validate → one query. The queries are mocked; their SQL is pinned in
// tests/queries-sql.test.ts. 4xx only for input that can never succeed (the player's
// outbox drops a request for good on any 4xx).
const m = vi.hoisted(() => ({
  getJourneyFeed: vi.fn(),
  markCoachMessagesRead: vi.fn(),
  upsertProgressSnapshot: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/db/queries', () => ({
  getJourneyFeed: m.getJourneyFeed,
  markCoachMessagesRead: m.markCoachMessagesRead,
  upsertProgressSnapshot: m.upsertProgressSnapshot,
}));
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }));

import { GET as getFeed } from '@/app/api/player/feed/route';
import { POST as postRead } from '@/app/api/player/feed/read/route';
import { PUT as putProgress } from '@/app/api/player/progress/route';

const AUTH = { authorization: 'Bearer stu-secret' };
const ID = '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d';
const feed = (query: string, headers: Record<string, string> = AUTH) => getFeed(new Request(`http://x/api/player/feed${query}`, { headers }));
const read = (body: unknown, headers: Record<string, string> = AUTH) =>
  postRead(new Request('http://x/api/player/feed/read', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const progress = (body: unknown, headers: Record<string, string> = AUTH) =>
  putProgress(new Request('http://x/api/player/progress', { method: 'PUT', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const SNAPSHOT = {
  course: 'react-2023', takenAt: Date.parse('2026-10-05T06:12:05.000Z'), lecturesDone: 9, lecturesTotal: 410,
  videoSecondsDone: 5400, videoSecondsTotal: 241_800, sectionsDone: [1, 2], current: null, days: { '2026-10-05': 6120 },
};
const EMPTY: JourneyFeed = { updates: [], notes: [], unreadForStudent: 0, nextCursor: null };

beforeEach(() => {
  process.env.STUDENT_TOKEN = 'stu-secret';
  process.env.COACH_TOKEN = 'coach-secret';
  vi.clearAllMocks();
});

describe('every v2 player route wants the student bearer token', () => {
  it('401 without it, or with the coach token', async () => {
    for (const h of [{}, { authorization: 'Bearer coach-secret' }] as Record<string, string>[]) {
      expect((await feed('?course=react-2023', h)).status).toBe(401);
      expect((await read({ ids: [] }, h)).status).toBe(401);
      expect((await progress(SNAPSHOT, h)).status).toBe(401);
    }
    expect(m.getJourneyFeed).not.toHaveBeenCalled();
    expect(m.markCoachMessagesRead).not.toHaveBeenCalled();
    expect(m.upsertProgressSnapshot).not.toHaveBeenCalled();
  });
});

describe('GET /api/player/feed', () => {
  it('200 JourneyFeed, never cached; first page = no cursor, limit 30', async () => {
    m.getJourneyFeed.mockResolvedValue(EMPTY);
    const res = await feed('?course=react-2023');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(await res.json()).toEqual(EMPTY);
    expect(m.getJourneyFeed).toHaveBeenCalledWith('react-2023', null, 30);
  });
  it('passes the decoded cursor and limit through', async () => {
    m.getJourneyFeed.mockResolvedValue(EMPTY);
    const cursor = encodeCursor({ createdAt: '2026-10-05T12:00:03.123456Z', id: ID });
    await feed(`?course=react-2023&cursor=${cursor}&limit=3`);
    expect(m.getJourneyFeed).toHaveBeenCalledWith('react-2023', { createdAt: '2026-10-05T12:00:03.123456Z', id: ID }, 3);
  });
  it('400 for a bad cursor / limit / missing course, 404 for an unknown course — with a reason', async () => {
    for (const [q, status, re] of [['', 400, /course/], ['?course=vue', 404, /vue/], ['?course=react-2023&cursor=x', 400, /cursor/], ['?course=react-2023&limit=500', 400, /limit/]] as const) {
      const res = await feed(q);
      expect(res.status).toBe(status);
      expect((await res.json()).error).toMatch(re);
    }
    expect(m.getJourneyFeed).not.toHaveBeenCalled();
  });
  it('500 (retry later) with a logged course when the database read fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.getJourneyFeed.mockRejectedValue(new Error('neon down'));
    const res = await feed('?course=react-2023');
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/retry later/);
    expect(String(spy.mock.calls[0][0])).toMatch(/react-2023/);
    spy.mockRestore();
  });
});

describe('POST /api/player/feed/read', () => {
  it('marks her coach messages read and says how many changed; a repeat is a harmless 200', async () => {
    m.markCoachMessagesRead.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const first = await read({ ids: [ID] });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ status: 'ok', marked: 1 });
    const again = await read({ ids: [ID] });
    expect(await again.json()).toEqual({ status: 'ok', marked: 0 });
    expect(m.markCoachMessagesRead).toHaveBeenCalledWith([ID]);
    expect(m.revalidatePath).toHaveBeenCalledWith('/r/[token]', 'page'); // the coach page shows what she has seen
  });
  it('400 for a body that can never succeed', async () => {
    for (const b of ['{nope', { ids: 'x' }, { ids: ['not-a-uuid'] }]) expect((await read(b)).status).toBe(400);
    expect(m.markCoachMessagesRead).not.toHaveBeenCalled();
  });
  it('500 when the write fails (the player retries)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.markCoachMessagesRead.mockRejectedValue(new Error('neon down'));
    expect((await read({ ids: [ID] })).status).toBe(500);
    spy.mockRestore();
  });
});

describe('PUT /api/player/progress', () => {
  // takenAt is checked against the server clock (≤ 24 h ahead): pin it to the snapshot's morning
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T07:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('stores a newer snapshot; an older or repeated one is a 200 "stale" no-op', async () => {
    m.upsertProgressSnapshot.mockResolvedValueOnce('stored').mockResolvedValueOnce('stale');
    const first = await progress(SNAPSHOT);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ status: 'stored' });
    expect(m.upsertProgressSnapshot).toHaveBeenCalledWith(SNAPSHOT);
    expect(m.revalidatePath).toHaveBeenCalledWith('/r/[token]', 'page');
    expect(await (await progress(SNAPSHOT)).json()).toEqual({ status: 'stale' });
  });
  it('400 with the field named for an invalid snapshot', async () => {
    const res = await progress({ ...SNAPSHOT, lecturesDone: 500 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/lecturesDone 500/);
    expect((await progress('{nope')).status).toBe(400);
    expect(m.upsertProgressSnapshot).not.toHaveBeenCalled();
  });
  it('400 for a takenAt from the future: newest-wins would let it lock out every honest snapshot', async () => {
    for (const takenAt of [Date.parse('2026-10-07T07:00:00.000Z'), 9_000_000_000_000_000]) {
      const res = await progress({ ...SNAPSHOT, takenAt });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/^takenAt /);
    }
    expect(m.upsertProgressSnapshot).not.toHaveBeenCalled();
  });
  it('500 when the write fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.upsertProgressSnapshot.mockRejectedValue(new Error('neon down'));
    expect((await progress(SNAPSHOT)).status).toBe(500);
    expect(String(spy.mock.calls[0][0])).toMatch(/react-2023/);
    spy.mockRestore();
  });
});
