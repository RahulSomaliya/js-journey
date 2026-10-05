import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { REACT_CURRICULUM } from '@/lib/curriculum';
import { REACT_PLAN } from '@/lib/config';
import { computeJourneyStatus } from '@/lib/status';
import { planRows } from '@/lib/journey-view';
import { REACT_SECTION_DUE } from './helpers';

// The route handlers are thin: auth → validate → query. The DB and the
// after-response side effects (email, revalidation) are mocked here.
const m = vi.hoisted(() => ({
  insertPlayerLog: vi.fn(),
  getSections: vi.fn(),
  getLogs: vi.fn(),
  latestCoachNote: vi.fn(),
  afterLogWritten: vi.fn(),
}));
vi.mock('@/lib/db/queries', () => ({
  insertPlayerLog: m.insertPlayerLog,
  getSections: m.getSections,
  getLogs: m.getLogs,
  latestCoachNote: m.latestCoachNote,
}));
vi.mock('@/lib/notify', () => ({ afterLogWritten: m.afterLogWritten }));

import { POST } from '@/app/api/player/sessions/route';
import { GET } from '@/app/api/player/status/route';

const SESSION = {
  id: '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d',
  course: 'react-2023',
  startedAt: '2026-10-05T04:30:00.000Z',
  endedAt: '2026-10-05T06:12:00.000Z',
  studyDate: '2026-10-05',
  minutes: 102,
  sectionNumber: 7,
  lecturesCompleted: [{ section: 7, lecture: 1, title: 'Section Overview' }],
  finishedSections: [],
  mood: '🙂',
  note: null,
  stuck: false,
  autoClosed: false,
  progress: null,
};
const SNAPSHOT = {
  course: 'react-2023', takenAt: Date.parse('2026-10-05T06:12:05.000Z'), lecturesDone: 9, lecturesTotal: 410,
  videoSecondsDone: 5400, videoSecondsTotal: 241_800, sectionsDone: [1, 2], current: null, days: { '2026-10-05': 6120 },
};
const post = (body: unknown, auth: string | null = 'Bearer stu-secret') =>
  POST(new Request('http://x/api/player/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
const get = (query: string, auth: string | null = 'Bearer stu-secret') =>
  GET(new Request(`http://x/api/player/status${query}`, { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  process.env.STUDENT_TOKEN = 'stu-secret';
  process.env.COACH_TOKEN = 'coach-secret';
  vi.clearAllMocks();
});

describe('POST /api/player/sessions', () => {
  // the snapshot's takenAt is checked against the server clock (≤ 24 h ahead): pin it to that morning
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T07:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('401 without, or with the wrong, bearer token — the coach token is not a student token', async () => {
    for (const auth of [null, 'Bearer nope', 'Bearer coach-secret', 'stu-secret']) {
      const res = await post(SESSION, auth);
      expect(res.status).toBe(401);
    }
    expect(m.insertPlayerLog).not.toHaveBeenCalled();
  });
  it('400 with a clear message on invalid JSON or an invalid session', async () => {
    const bad = await post('{not json');
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/JSON/);
    const res = await post({ ...SESSION, sectionNumber: 99 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/sectionNumber 99/);
    expect(m.insertPlayerLog).not.toHaveBeenCalled();
  });
  it('201 stores the mapped row once and schedules the coach email', async () => {
    m.insertPlayerLog.mockResolvedValue({ log: 'created', progress: null });
    const res = await post(SESSION);
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(await res.json()).toEqual({ status: 'created', id: SESSION.id, progress: null });
    expect(m.insertPlayerLog).toHaveBeenCalledTimes(1);
    expect(m.insertPlayerLog.mock.calls[0][0]).toMatchObject({
      course: 'react-2023', sectionId: 107, minutes: 102, source: 'player', externalId: SESSION.id, stuck: false, autoClosed: false,
    });
    expect(m.insertPlayerLog.mock.calls[0][1]).toBeNull();
    expect(m.afterLogWritten).toHaveBeenCalledTimes(1);
  });
  it('a retry of the same session id is a 200 no-op (no second row, no second email)', async () => {
    m.insertPlayerLog.mockResolvedValue({ log: 'duplicate', progress: null });
    const res = await post(SESSION);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'duplicate', id: SESSION.id, progress: null });
    expect(m.afterLogWritten).not.toHaveBeenCalled();
  });
  it('v2: stores stuck / autoClosed and hands the snapshot to the same write (newest wins there)', async () => {
    m.insertPlayerLog.mockResolvedValue({ log: 'created', progress: 'stored' });
    const res = await post({ ...SESSION, stuck: true, autoClosed: true, progress: SNAPSHOT });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: 'created', id: SESSION.id, progress: 'stored' });
    expect(m.insertPlayerLog.mock.calls[0][0]).toMatchObject({ stuck: true, autoClosed: true });
    expect(m.insertPlayerLog.mock.calls[0][1]).toEqual(SNAPSHOT);
    expect(m.afterLogWritten.mock.calls[0][0]).toMatchObject({ stuck: true });
  });
  it('v2: a note-only update (0 minutes + note) is stored; 0 minutes without a note is a 400', async () => {
    m.insertPlayerLog.mockResolvedValue({ log: 'created', progress: null });
    expect((await post({ ...SESSION, minutes: 0, note: 'Did the exercises on paper' })).status).toBe(201);
    expect(m.insertPlayerLog.mock.calls[0][0]).toMatchObject({ minutes: 0, note: 'Did the exercises on paper' });
    const bad = await post({ ...SESSION, minutes: 0, note: null });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/note-only/);
  });
  it('v2: an unusable snapshot never costs her the update — stored without it, said so, and logged', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.insertPlayerLog.mockResolvedValue({ log: 'created', progress: null });
    const res = await post({ ...SESSION, progress: { ...SNAPSHOT, days: { yesterday: 1 } } });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: 'created', id: SESSION.id, progress: 'ignored' });
    expect(m.insertPlayerLog.mock.calls[0][1]).toBeNull();
    expect(String(spy.mock.calls[0][0])).toMatch(new RegExp(`${SESSION.id}.*progress ignored: days key "yesterday"`));
    spy.mockRestore();
  });
  it('v2: a snapshot from the future (her Mac clock wrong, or past the JS Date range) is ignored — the session still lands', async () => {
    // before the fix it reached the upsert: RangeError while building the query → 500 → the outbox
    // retried her minutes + note forever; a 2100 snapshot would have locked out every later one
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.insertPlayerLog.mockResolvedValue({ log: 'created', progress: null });
    for (const takenAt of [9_000_000_000_000_000, Date.parse('2100-01-01T00:00:00Z')]) {
      const res = await post({ ...SESSION, progress: { ...SNAPSHOT, takenAt } });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ status: 'created', id: SESSION.id, progress: 'ignored' });
    }
    expect(m.insertPlayerLog.mock.calls.every((c) => c[1] === null)).toBe(true);
    spy.mockRestore();
  });
  it('500 (so the player retries) when the database write fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.insertPlayerLog.mockRejectedValue(new Error('neon down'));
    const res = await post(SESSION);
    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('GET /api/player/status', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T06:00:00.000Z')); // Thu 1 Oct, IST afternoon
  });
  afterEach(() => vi.useRealTimers());

  it('401 without the student bearer token', async () => {
    expect((await get('?course=react-2023', null)).status).toBe(401);
    expect((await get('?course=react-2023', 'Bearer coach-secret')).status).toBe(401);
  });
  it('404 for an unknown course, 400 when the course is missing', async () => {
    const res = await get('?course=vue-2024');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/vue-2024/);
    expect((await get('')).status).toBe(400);
  });
  it('200 JourneyStatus for the course, never cached', async () => {
    m.getSections.mockResolvedValue(REACT_CURRICULUM);
    m.getLogs.mockResolvedValue([]);
    m.latestCoachNote.mockResolvedValue({
      id: 'n1', createdAt: '2026-09-30T12:00:00.000Z', author: 'coach', kind: 'encouragement', body: 'React next! 💚', sectionId: null, resolvedAt: null,
    });
    const res = await get('?course=react-2023');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(m.getSections).toHaveBeenCalledWith('react-2023');
    expect(m.getLogs).toHaveBeenCalledWith('react-2023');
    expect(await res.json()).toEqual({
      pace: 'on-track',
      daysDelta: 0,
      week: 1,
      totalWeeks: 10,
      targetDate: '2026-12-25',
      deadline: '2027-01-01',
      goal: { sectionNumber: 5, title: 'Working With Components, Props, and JSX', due: '2026-10-09' },
      coachNote: { body: 'React next! 💚', createdAt: '2026-09-30T12:00:00.000Z' },
      planBreak: null,
      sectionDue: REACT_SECTION_DUE,
      skippedSections: [4],
      studyWeekdays: [1, 2, 3, 4, 5],
      planBreaks: [{ label: 'Diwali', start: '2026-11-01', end: '2026-11-15' }],
      plan: expect.any(Array),
    });
  });
  it('v3: carries her plan — exactly the coach page\'s plan rows (planRows), the break in place', async () => {
    m.getSections.mockResolvedValue(REACT_CURRICULUM);
    m.getLogs.mockResolvedValue([]);
    m.latestCoachNote.mockResolvedValue(null);
    const body = await (await get('?course=react-2023')).json();
    const today = '2026-10-01';
    const status = computeJourneyStatus({ today, sections: REACT_CURRICULUM, logs: [], config: REACT_PLAN, coachNote: null });
    expect(body.plan).toEqual(planRows({ sections: REACT_CURRICULUM, logs: [], config: REACT_PLAN, status, today }));
    // the contract shape, pinned (course-player shared/types.ts PlanRow mirrors it)
    expect(body.plan).toHaveLength(11); // 10 study weeks + the Diwali break
    expect(body.plan[0]).toEqual({ kind: 'week', week: 1, due: '2026-10-09', goal: 'Finish §05 Working With Components, Props, and JSX', state: 'current' });
    expect(body.plan[1]).toMatchObject({ kind: 'week', week: 2, state: 'upcoming' });
    expect(body.plan[4]).toEqual({ kind: 'break', label: 'Diwali', start: '2026-11-01', end: '2026-11-15', now: false });
    // no extra read for it: the plan is built from the rows the status already loaded
    expect(m.getSections).toHaveBeenCalledTimes(1);
    expect(m.getLogs).toHaveBeenCalledTimes(1);
  });
  it('500 with a JSON error and a contextual log line when a database read fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.getSections.mockResolvedValue(REACT_CURRICULUM);
    m.getLogs.mockRejectedValue(new Error('neon down'));
    m.latestCoachNote.mockResolvedValue(null);
    const res = await get('?course=react-2023');
    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect((await res.json()).error).toMatch(/retry later/);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toMatch(/react-2023/);
    spy.mockRestore();
  });
});

describe('GET /api/player/status during a plan break', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T06:00:00.000Z')); // Wed 4 Nov, mid-Diwali (IST)
  });
  afterEach(() => vi.useRealTimers());

  it('returns the break in progress', async () => {
    m.getSections.mockResolvedValue(REACT_CURRICULUM);
    m.getLogs.mockResolvedValue([]);
    m.latestCoachNote.mockResolvedValue(null);
    const body = await (await get('?course=react-2023')).json();
    expect(body.planBreak).toEqual({ label: 'Diwali', start: '2026-11-01', end: '2026-11-15' });
  });
});

describe('proxy', () => {
  it('never matches the player API (it authenticates itself with the bearer token)', async () => {
    const { config } = await import('@/proxy');
    for (const pattern of config.matcher) expect(pattern.startsWith('/api')).toBe(false);
  });
});
