import { describe, it, expect } from 'vitest';
import { logEmailSubject, logEmailLine } from '@/lib/email';
import type { PaceResult, Section } from '@/lib/schedule';

describe('logEmailSubject', () => {
  it('first session of the day: plain subject', () => {
    expect(logEmailSubject(60, 60)).toBe('Mansi logged 1.0h today');
  });
  it('2nd+ session: subject carries the day total', () => {
    expect(logEmailSubject(60, 150)).toBe('Mansi logged 1.0h — 2.5h total today');
  });
  it('rounds to one decimal', () => {
    expect(logEmailSubject(105, 105)).toBe('Mansi logged 1.8h today');
  });
});

describe('logEmailLine', () => {
  const pace = { status: 'on_track', contentPct: 12 } as PaceResult;
  const sections: Section[] = [{ id: 107, title: 'Thinking In React - State Management', videoMinutes: 162, kind: 'core', sortOrder: 7 }];
  it('manual check-in line is unchanged', () => {
    expect(logEmailLine({ minutes: 90, sectionId: 107, finishedSection: false }, pace, sections))
      .toBe('Mansi logged 1.5h on Thinking In React - State Management — on track. 12% of the course done.');
  });
  it('player sessions say where they came from and how many lectures were completed', () => {
    expect(logEmailLine({ minutes: 102, sectionId: 107, finishedSection: true, source: 'player', lectureCount: 9 }, pace, sections))
      .toBe('Mansi logged 1.7h on Thinking In React - State Management (finished it ✓) via the Course Player, 9 lectures — on track. 12% of the course done.');
  });
});
