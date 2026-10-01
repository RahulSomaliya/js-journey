import { describe, it, expect } from 'vitest';
import { fmtDur, fmtSeconds, fmtShortDate, fmtTime, fmtWhen, plural, sectionTag } from '@/lib/format';

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

describe('sectionTag', () => {
  it('formats a course section number as §NN', () => {
    expect(sectionTag(7)).toBe('§07');
    expect(sectionTag(31)).toBe('§31');
  });
});

describe('fmtSeconds (the player\'s formatDuration: whole minutes, rounded down)', () => {
  it('formats seconds as Xh Ym', () => {
    expect(fmtSeconds(0)).toBe('0m');
    expect(fmtSeconds(59)).toBe('0m');
    expect(fmtSeconds(60)).toBe('1m');
    expect(fmtSeconds(3600)).toBe('1h');
    expect(fmtSeconds(6974)).toBe('1h 56m');
    expect(fmtSeconds(-5)).toBe('0m');
  });
});

describe('fmtShortDate', () => {
  it('prints a day without the weekday', () => {
    expect(fmtShortDate('2026-09-22')).toBe('22 Sep');
  });
});

describe('fmtTime / fmtWhen — always Asia/Kolkata, whatever the machine zone', () => {
  it('prints the IST wall-clock time', () => {
    expect(fmtTime('2026-10-21T13:25:00.000Z')).toBe('18:55');
    expect(fmtTime('2026-10-20T19:00:00.000Z')).toBe('00:30');
  });
  it('says today / yesterday / the weekday within a week, else the date', () => {
    const today = '2026-10-21';
    expect(fmtWhen('2026-10-21T13:25:00.000Z', today)).toBe('Today 18:55');
    expect(fmtWhen('2026-10-20T19:00:00.000Z', today)).toBe('Today 00:30'); // 00:30 IST on the 21st
    expect(fmtWhen('2026-10-20T14:10:00.000Z', today)).toBe('Yesterday 19:40');
    expect(fmtWhen('2026-10-16T14:25:00.000Z', today)).toBe('Fri 19:55');
    expect(fmtWhen('2026-10-05T14:40:00.000Z', today)).toBe('Mon 5 Oct');
  });
});

describe('plural', () => {
  it('counts a noun', () => {
    expect(plural(1, 'lecture')).toBe('1 lecture');
    expect(plural(3, 'lecture')).toBe('3 lectures');
    expect(plural(2, 'day')).toBe('2 days');
  });
});
