import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canSignOff, parseJourneySession, parseProgressSnapshot, parseReadIds, sessionToLog, type JourneySession, type ProgressSnapshot } from '@/lib/player';

const base: JourneySession = {
  id: '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d',
  course: 'react-2023',
  startedAt: '2026-10-05T04:30:00.000Z',
  endedAt: '2026-10-05T06:12:00.000Z',
  studyDate: '2026-10-05',
  minutes: 102,
  sectionNumber: 7,
  lecturesCompleted: [
    { section: 6, lecture: 18, title: 'Section Summary' },
    { section: 7, lecture: 1, title: 'Section Overview' },
  ],
  finishedSections: [6],
  mood: '🙂',
  note: '  Lifting state up finally clicked.  ',
  stuck: false,
  autoClosed: false,
  progress: null,
};
const SNAPSHOT: ProgressSnapshot = {
  course: 'react-2023',
  takenAt: Date.parse('2026-10-05T06:12:05.000Z'),
  lecturesDone: 58,
  lecturesTotal: 410,
  videoSecondsDone: 31_000.5,
  videoSecondsTotal: 241_800.25,
  sectionsDone: [3, 1, 2],
  current: { sectionNumber: 7, lectureNumber: 2, title: 'What is "Thinking in React"?' },
  days: { '2026-10-05': 6120, '2026-10-02': 0 },
};
// a snapshot's takenAt is checked against the server clock (≤ 24 h ahead): pin it to that morning,
// or these 5 Oct fixtures read as "from the future" on any earlier real date
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T07:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());
const snapErr = (b: unknown, now = SNAPSHOT.takenAt) => {
  const r = parseProgressSnapshot(b, now);
  if (r.ok) throw new Error('expected a snapshot validation error');
  return r.error;
};
const body = (patch: Record<string, unknown>) => ({ ...base, ...patch });
const err = (b: unknown) => {
  const r = parseJourneySession(b);
  if (r.ok) throw new Error('expected a validation error');
  return r.error;
};

describe('parseJourneySession', () => {
  it('accepts a valid session and normalises the note', () => {
    const r = parseJourneySession(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.session.course).toBe('react-2023');
    expect(r.session.note).toBe('Lifting state up finally clicked.');
    expect(r.session.mood).toBe('🙂');
  });
  it('accepts null mood/note and an empty note becomes null', () => {
    const r = parseJourneySession(body({ mood: null, note: '   ' }));
    expect(r.ok && r.session.mood === null && r.session.note === null).toBe(true);
  });
  it('rejects a non-object body', () => {
    expect(err(null)).toMatch(/JSON object/);
    expect(err([base])).toMatch(/JSON object/);
    expect(err('hi')).toMatch(/JSON object/);
  });
  it('rejects a missing or malformed id', () => {
    expect(err(body({ id: undefined }))).toMatch(/^id /);
    expect(err(body({ id: 'not-a-uuid' }))).toMatch(/^id /);
  });
  it('rejects an unknown course, naming it', () => {
    expect(err(body({ course: 'vue-2024' }))).toMatch(/course "vue-2024"/);
  });
  it('rejects minutes that are not a whole number in 0..1440', () => {
    for (const m of [-5, 1.5, 1441, '90', null]) expect(err(body({ minutes: m }))).toMatch(/^minutes /);
  });
  it('minutes 0 is a note-only update: allowed with a note, refused without one', () => {
    const r = parseJourneySession(body({ minutes: 0, note: 'Built the form in VS Code, away from the player' }));
    expect(r.ok && r.session.minutes).toBe(0);
    expect(err(body({ minutes: 0, note: null }))).toMatch(/minutes may be 0 only .*note/);
    expect(err(body({ minutes: 0, note: '   ' }))).toMatch(/minutes may be 0 only/);
  });
  it('rejects a studyDate that is not a real YYYY-MM-DD date', () => {
    for (const d of ['2026-13-01', '2026-02-30', '5 Oct 2026', '', 20261005]) expect(err(body({ studyDate: d }))).toMatch(/^studyDate /);
  });
  it('rejects bad timestamps and endedAt before startedAt', () => {
    expect(err(body({ startedAt: 'yesterday' }))).toMatch(/^startedAt /);
    expect(err(body({ endedAt: '2026-10-05T04:00:00.000Z' }))).toMatch(/endedAt .*before startedAt/);
  });
  it('rejects a sectionNumber that is not a section of the course', () => {
    expect(err(body({ sectionNumber: 32 }))).toMatch(/sectionNumber 32 .*react-2023/);
    expect(err(body({ sectionNumber: 2.5 }))).toMatch(/^sectionNumber /);
  });
  it('rejects unknown finished sections and malformed lists', () => {
    expect(err(body({ finishedSections: [6, 40] }))).toMatch(/finishedSections .*40/);
    expect(err(body({ finishedSections: 'six' }))).toMatch(/^finishedSections /);
    expect(err(body({ lecturesCompleted: [{ section: 7, lecture: 'one', title: 'x' }] }))).toMatch(/^lecturesCompleted\[0\]/);
    expect(err(body({ lecturesCompleted: null }))).toMatch(/^lecturesCompleted /);
  });
  it('accepts only the four player moods (ignoring an emoji variation selector)', () => {
    expect(err(body({ mood: '🤖' }))).toMatch(/^mood /);
    const r = parseJourneySession(body({ mood: '😐️' }));
    expect(r.ok && r.session.mood).toBe('😐');
  });
  it('rejects an absurdly long note instead of silently truncating it', () => {
    expect(err(body({ note: 'x'.repeat(10_001) }))).toMatch(/^note /);
  });
  it('carries the v2 stuck / autoClosed flags', () => {
    const r = parseJourneySession(body({ stuck: true, autoClosed: true }));
    expect(r.ok && [r.session.stuck, r.session.autoClosed]).toEqual([true, true]);
    expect(err(body({ stuck: 'yes' }))).toMatch(/^stuck /);
    expect(err(body({ autoClosed: 1 }))).toMatch(/^autoClosed /);
  });
  it('a v1 session (queued before the player update: no stuck/autoClosed/progress) still lands', () => {
    const v1: Record<string, unknown> = { ...base };
    for (const key of ['stuck', 'autoClosed', 'progress']) delete v1[key];
    const r = parseJourneySession(v1);
    if (!r.ok) throw new Error(r.error);
    expect([r.session.stuck, r.session.autoClosed, r.session.progress, r.progressIgnored]).toEqual([false, false, null, null]);
  });
  it('accepts a progress snapshot and normalises it', () => {
    const r = parseJourneySession(body({ progress: { ...SNAPSHOT, extra: 'dropped' } }), SNAPSHOT.takenAt);
    if (!r.ok) throw new Error(r.error);
    expect(r.progressIgnored).toBeNull();
    expect(r.session.progress).toEqual({ ...SNAPSHOT, sectionsDone: [1, 2, 3] });
  });
  it('a snapshot from the future is ignored, never a 400/500 for the session (her minutes + note still land)', () => {
    const r = parseJourneySession(body({ progress: { ...SNAPSHOT, takenAt: 9_000_000_000_000_000 } }), SNAPSHOT.takenAt);
    if (!r.ok) throw new Error(r.error);
    expect(r.session.progress).toBeNull();
    expect(r.progressIgnored).toMatch(/^progress ignored: takenAt /);
  });
  it('a bad snapshot never fails the session (the outbox would drop her note) — it is ignored with a reason', () => {
    const r = parseJourneySession(body({ progress: { ...SNAPSHOT, lecturesDone: -1 } }));
    if (!r.ok) throw new Error(r.error);
    expect(r.session.progress).toBeNull();
    expect(r.progressIgnored).toMatch(/^progress ignored: lecturesDone/);
    const js = parseJourneySession(body({ progress: { ...SNAPSHOT, course: 'js' } }));
    expect(js.ok && js.progressIgnored).toMatch(/snapshot course "js"/);
  });
});

describe('parseProgressSnapshot', () => {
  it('accepts a valid snapshot (null current, empty days)', () => {
    const r = parseProgressSnapshot({ ...SNAPSHOT, current: null, days: {} });
    expect(r.ok).toBe(true);
  });
  it('rejects an unknown course and a bad takenAt', () => {
    expect(snapErr({ ...SNAPSHOT, course: 'vue' })).toMatch(/course "vue"/);
    for (const t of [0, -1, 1.5, '1759644725000', null]) expect(snapErr({ ...SNAPSHOT, takenAt: t })).toMatch(/^takenAt /);
  });
  it('refuses a takenAt more than 24 h ahead of the server clock, and one past the JS Date range', () => {
    // newest takenAt wins the upsert: ONE far-future row (her Mac's clock wrong) would answer
    // "stale" to every honest snapshot after it; a takenAt > 8.64e15 is no Date at all (RangeError)
    const now = SNAPSHOT.takenAt;
    expect(parseProgressSnapshot({ ...SNAPSHOT, takenAt: now + 23 * 3_600_000 }, now).ok).toBe(true);
    expect(snapErr({ ...SNAPSHOT, takenAt: now + 25 * 3_600_000 }, now)).toMatch(/^takenAt .*ahead of the server clock/);
    expect(snapErr({ ...SNAPSHOT, takenAt: 9_000_000_000_000_000 }, now)).toMatch(/^takenAt /);
    expect(snapErr({ ...SNAPSHOT, takenAt: Date.parse('2100-01-01T00:00:00Z') }, now)).toMatch(/^takenAt /);
  });
  it('rejects impossible counts', () => {
    expect(snapErr({ ...SNAPSHOT, lecturesDone: 411 })).toMatch(/lecturesDone 411 is more than lecturesTotal 410/);
    expect(snapErr({ ...SNAPSHOT, videoSecondsDone: Number.NaN })).toMatch(/^videoSecondsDone /);
    expect(snapErr({ ...SNAPSHOT, sectionsDone: [1, 40] })).toMatch(/sectionsDone 40/);
  });
  it('rejects a bad current lecture', () => {
    expect(snapErr({ ...SNAPSHOT, current: { sectionNumber: 99, lectureNumber: 1, title: 'x' } })).toMatch(/current.sectionNumber 99/);
    expect(snapErr({ ...SNAPSHOT, current: { sectionNumber: 7 } })).toMatch(/^current /);
  });
  it('rejects bad day keys and impossible day totals', () => {
    expect(snapErr({ ...SNAPSHOT, days: { '5 Oct': 60 } })).toMatch(/days key "5 Oct"/);
    expect(snapErr({ ...SNAPSHOT, days: { '2026-10-05': 90_000 } })).toMatch(/days\["2026-10-05"\]/);
    expect(snapErr({ ...SNAPSHOT, days: [] })).toMatch(/^days /);
  });
});

describe('canSignOff — one rule for the player API, the web action and the web form', () => {
  it('study time, or a note — never neither (the web form used to start at 1h: one tap sent an hour she never studied)', () => {
    expect(canSignOff(0, '')).toBe(false);
    expect(canSignOff(0, '   \n ')).toBe(false);
    expect(canSignOff(0, 'Read the docs on my phone')).toBe(true);
    expect(canSignOff(15, '')).toBe(true);
  });
});

describe('parseReadIds', () => {
  const id = 'aa8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d';
  it('accepts uuids, lower-cases and de-duplicates them; an empty list is fine', () => {
    expect(parseReadIds({ ids: [id, id.toUpperCase()] })).toEqual({ ok: true, ids: [id] });
    expect(parseReadIds({ ids: [] })).toEqual({ ok: true, ids: [] });
  });
  it('rejects a non-object body and non-uuid ids, naming the index', () => {
    expect(parseReadIds([id])).toMatchObject({ ok: false });
    expect(parseReadIds({ ids: [id, 'nope'] })).toEqual({ ok: false, error: 'ids[1] must be a uuid string' });
  });
});

describe('sessionToLog', () => {
  it('maps a player session onto a React log row', () => {
    const r = parseJourneySession(base);
    if (!r.ok) throw new Error(r.error);
    expect(sessionToLog(r.session)).toEqual({
      course: 'react-2023',
      studyDate: '2026-10-05',
      sectionId: 107,
      minutes: 102,
      note: 'Lifting state up finally clicked.',
      mood: '🙂',
      finishedSection: false, // §07 itself was not finished…
      alsoFinishedIds: [106], // …but §06 was, mid-session
      lecturesCompleted: base.lecturesCompleted,
      source: 'player',
      externalId: base.id,
      startedAt: base.startedAt,
      endedAt: base.endedAt,
      stuck: false,
      autoClosed: false,
    });
  });
  it('flags the main section finished and de-duplicates the rest', () => {
    const r = parseJourneySession(body({ finishedSections: [7, 6, 6, 5] }));
    if (!r.ok) throw new Error(r.error);
    const row = sessionToLog(r.session);
    expect(row.finishedSection).toBe(true);
    expect(row.alsoFinishedIds).toEqual([105, 106]);
  });
  it('lower-cases the session id so a retry with different casing still dedups', () => {
    const r = parseJourneySession(body({ id: base.id.toUpperCase() }));
    if (!r.ok) throw new Error(r.error);
    expect(sessionToLog(r.session).externalId).toBe(base.id);
  });
});
