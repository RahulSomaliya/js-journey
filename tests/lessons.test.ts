import { describe, it, expect } from 'vitest';
import { LESSONS, playerLessons } from '@/lib/lessons';
import type { LogEntry } from '@/lib/schedule';
import { CURRICULUM } from '@/lib/curriculum';

const coreIds = CURRICULUM.filter((s) => s.kind === 'core').map((s) => s.id);
const validIds = new Set(CURRICULUM.map((s) => s.id));

describe('lessons data', () => {
  it('has at least one lesson for every core section', () => {
    for (const id of coreIds) {
      expect(LESSONS[id]?.length ?? 0, `section ${id}`).toBeGreaterThan(0);
    }
  });
  it('every lesson has a non-empty title', () => {
    for (const list of Object.values(LESSONS)) {
      for (const l of list) expect(l.title.trim().length).toBeGreaterThan(0);
    }
  });
  it('every key is a valid section id', () => {
    for (const k of Object.keys(LESSONS)) expect(validIds.has(Number(k))).toBe(true);
  });
  it('total lecture count is in the published range (~332)', () => {
    const total = Object.values(LESSONS).reduce((n, l) => n + l.length, 0);
    expect(total).toBeGreaterThan(280);
    expect(total).toBeLessThan(400);
  });
});

describe('playerLessons (React curriculum detail from Course Player sessions)', () => {
  it('groups completed lectures by section id, de-duplicated and in lecture order', () => {
    const logs: LogEntry[] = [
      { id: 'b', studyDate: '2026-10-06', minutes: 90, sectionId: 107, finishedSection: false, source: 'player',
        lecturesCompleted: [{ section: 7, lecture: 3, title: 'Lifting State Up' }, { section: 6, lecture: 18, title: 'Summary' }] },
      { id: 'a', studyDate: '2026-10-05', minutes: 60, sectionId: 107, finishedSection: false, source: 'player',
        lecturesCompleted: [{ section: 7, lecture: 1, title: 'Overview' }, { section: 7, lecture: 3, title: 'Lifting State Up' }] },
      { id: 'm', studyDate: '2026-10-05', minutes: 30, sectionId: 107, finishedSection: false, source: 'manual', lecturesCompleted: null },
    ];
    expect(playerLessons('react-2023', logs)).toEqual({
      106: [{ number: 18, title: 'Summary' }],
      107: [{ number: 1, title: 'Overview' }, { number: 3, title: 'Lifting State Up' }],
    });
  });
  it('ignores lectures whose section is not in the course', () => {
    const logs: LogEntry[] = [
      { id: 'x', studyDate: '2026-10-05', minutes: 10, sectionId: 101, finishedSection: false, lecturesCompleted: [{ section: 99, lecture: 1, title: '?' }] },
    ];
    expect(playerLessons('react-2023', logs)).toEqual({});
  });
});
