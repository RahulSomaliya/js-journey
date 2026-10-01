import { describe, it, expect } from 'vitest';
import { fmtDur, fmtDateRange, sectionTag, sessionSummary } from '@/lib/format';

describe('fmtDur', () => {
  it('formats durations as Xh Ym', () => {
    expect(fmtDur(0)).toBe('0m');
    expect(fmtDur(45)).toBe('45m');
    expect(fmtDur(60)).toBe('1h');
    expect(fmtDur(75)).toBe('1h 15m');
    expect(fmtDur(105)).toBe('1h 45m');
    expect(fmtDur(4092)).toBe('68h 12m');
  });
});

describe('fmtDateRange', () => {
  it('prints an inclusive day range, e.g. a plan break', () => {
    expect(fmtDateRange('2026-11-01', '2026-11-15')).toBe('Sun 1 Nov – Sun 15 Nov');
    expect(fmtDateRange('2026-11-02', '2026-11-02')).toBe('Mon 2 Nov');
  });
});

describe('sectionTag', () => {
  it('formats a course section number as §NN', () => {
    expect(sectionTag(7)).toBe('§07');
    expect(sectionTag(31)).toBe('§31');
  });
});

describe('sessionSummary', () => {
  it('describes a player session the way Mansi sees it', () => {
    const lectures = Array.from({ length: 9 }, (_, i) => ({ section: 7, lecture: i + 1, title: `L${i + 1}` }));
    expect(sessionSummary({ source: 'player', minutes: 102, lecturesCompleted: lectures, mood: '🙂' }, 7))
      .toBe('From the player · 1h 42m · 9 lectures · §07 · 🙂');
  });
  it('singular lecture, no mood, no section', () => {
    expect(sessionSummary({ source: 'player', minutes: 25, lecturesCompleted: [{ section: 3, lecture: 2, title: 'x' }], mood: null }, null))
      .toBe('From the player · 25m · 1 lecture');
  });
  it('manual check-ins say so and never mention lectures', () => {
    expect(sessionSummary({ source: 'manual', minutes: 120, lecturesCompleted: null, mood: '🚀' }, 12)).toBe('Check-in · 2h · §12 · 🚀');
    expect(sessionSummary({ minutes: 60 }, 3)).toBe('Check-in · 1h · §03');
  });
});
