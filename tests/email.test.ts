import { describe, it, expect } from 'vitest';
import { logEmailSubject, logEmailLine } from '@/lib/email';
import type { Section } from '@/lib/schedule';

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
  it('a note-only update (0 minutes) says so instead of "logged 0.0h"', () => {
    expect(logEmailSubject(0, 90)).toBe('Mansi sent you a note');
  });
  it('flags a stuck update up front', () => {
    expect(logEmailSubject(60, 60, true)).toBe('Stuck: Mansi logged 1.0h today');
    expect(logEmailSubject(0, 0, true)).toBe('Stuck: Mansi sent you a note');
  });
});

describe('logEmailLine', () => {
  // the pace words are the pages' own (paceLabel over lib/status.ts planPace) — the email said "behind"
  // from a second model while his page said "On track"
  const pace = { label: 'On track', contentPct: 12 };
  const sections: Section[] = [{ id: 107, title: 'Thinking In React - State Management', videoMinutes: 162, kind: 'core', sortOrder: 7 }];
  it('manual check-in line is unchanged', () => {
    expect(logEmailLine({ minutes: 90, sectionId: 107, finishedSection: false }, pace, sections))
      .toBe('Mansi logged 1.5h on Thinking In React - State Management — on track. 12% of the course done.');
  });
  it('player sessions say where they came from and how many lectures were completed', () => {
    expect(logEmailLine({ minutes: 102, sectionId: 107, finishedSection: true, source: 'player', lectureCount: 9 }, pace, sections))
      .toBe('Mansi logged 1.7h on Thinking In React - State Management (finished it ✓) via the Course Player, 9 lectures — on track. 12% of the course done.');
  });
  it('a stuck update says so, and where to answer', () => {
    expect(logEmailLine({ minutes: 45, sectionId: 107, finishedSection: false, source: 'player', lectureCount: 2, stuck: true }, pace, sections))
      .toBe("Mansi logged 0.8h on Thinking In React - State Management via the Course Player, 2 lectures — on track. 12% of the course done. She marked it \"I'm stuck\" — reply on your coach page.");
  });
  it('says the pace the way the pages do, with the days', () => {
    expect(logEmailLine({ minutes: 60, sectionId: 107, finishedSection: false }, { label: 'Behind by 5 days', contentPct: 7 }, sections))
      .toBe('Mansi logged 1.0h on Thinking In React - State Management — behind by 5 days. 7% of the course done.');
  });
  it('a note-only update reads as a note', () => {
    expect(logEmailLine({ minutes: 0, sectionId: 107, finishedSection: false, source: 'player', lectureCount: 0 }, pace, sections))
      .toBe('Mansi sent a note (no study time) on Thinking In React - State Management via the Course Player — on track. 12% of the course done.');
  });
});
