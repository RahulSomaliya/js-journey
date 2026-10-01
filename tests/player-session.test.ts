import { describe, it, expect } from 'vitest';
import { parseJourneySession, sessionToLog, type JourneySession } from '@/lib/player';

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
  it('rejects minutes that are not a whole number in 1..1440', () => {
    for (const m of [0, -5, 1.5, 1441, '90', null]) expect(err(body({ minutes: m }))).toMatch(/^minutes /);
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
