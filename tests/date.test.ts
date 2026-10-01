import { describe, it, expect } from 'vitest';
import { addDays, addStudyDays, diffDays, dayOfWeek, isoWeekday, todayInTZ, inBreak, isStudyDay, studyDaysBetween, addOpenDays } from '@/lib/date';

describe('date helpers', () => {
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-06-22', 4)).toBe('2026-06-26');
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
  });
  it('diffDays is end minus start', () => {
    expect(diffDays('2026-06-22', '2026-06-26')).toBe(4);
    expect(diffDays('2026-06-26', '2026-06-22')).toBe(-4);
  });
  it('dayOfWeek: 2026-06-22 is Monday(1), 2026-06-26 is Friday(5)', () => {
    expect(dayOfWeek('2026-06-22')).toBe(1);
    expect(dayOfWeek('2026-06-26')).toBe(5);
  });
  it('isoWeekday: Mon = 1 … Sun = 7 (JourneyStatus.studyWeekdays)', () => {
    expect(['2026-06-22', '2026-06-26', '2026-06-27', '2026-06-28'].map(isoWeekday)).toEqual([1, 5, 6, 7]);
  });
  it('isStudyDay: Mon–Fri only (no breaks)', () => {
    expect(isStudyDay('2026-06-26', [])).toBe(true);  // Fri
    expect(isStudyDay('2026-06-27', [])).toBe(false); // Sat
    expect(isStudyDay('2026-06-28', [])).toBe(false); // Sun
  });
  it('todayInTZ returns YYYY-MM-DD for a fixed instant', () => {
    // 2026-06-22T20:00:00Z == 2026-06-23 01:30 IST
    const d = new Date('2026-06-22T20:00:00Z');
    expect(todayInTZ('Asia/Kolkata', d)).toBe('2026-06-23');
  });
});

describe('addStudyDays', () => {
  it('returns the same date for n = 0', () => {
    expect(addStudyDays('2026-06-26', 0, [])).toBe('2026-06-26');
  });
  it('skips the weekend: Friday + 1 study-day = Monday', () => {
    expect(addStudyDays('2026-06-26', 1, [])).toBe('2026-06-29'); // Fri → Mon
  });
  it('Monday + 4 study-days = same-week Friday', () => {
    expect(addStudyDays('2026-06-22', 4, [])).toBe('2026-06-26');
  });
  it('Friday + 5 study-days = next Friday', () => {
    expect(addStudyDays('2026-06-26', 5, [])).toBe('2026-07-03');
  });
});

// Diwali 2026: Sun 1 Nov .. Sun 15 Nov inclusive — 15 calendar days, 10 of them weekdays
const DIWALI = [{ start: '2026-11-01', end: '2026-11-15' }];

describe('plan breaks (inclusive day ranges with no study)', () => {
  it('inBreak includes both ends', () => {
    expect(inBreak('2026-10-31', DIWALI)).toBe(false);
    expect(inBreak('2026-11-01', DIWALI)).toBe(true);
    expect(inBreak('2026-11-09', DIWALI)).toBe(true);
    expect(inBreak('2026-11-15', DIWALI)).toBe(true);
    expect(inBreak('2026-11-16', DIWALI)).toBe(false);
  });
  it('a study day is Mon–Fri outside every break', () => {
    expect(isStudyDay('2026-10-30', DIWALI)).toBe(true); // Fri before
    expect(isStudyDay('2026-11-02', DIWALI)).toBe(false); // Mon inside
    expect(isStudyDay('2026-11-16', DIWALI)).toBe(true); // Mon after
    expect(isStudyDay('2026-11-21', DIWALI)).toBe(false); // Sat
    expect(isStudyDay('2026-11-02', [])).toBe(true);
  });
  it('studyDaysBetween counts [start, end) and skips break days', () => {
    expect(studyDaysBetween('2026-06-22', '2026-06-29', [])).toBe(5);
    expect(studyDaysBetween('2026-06-29', '2026-06-22', [])).toBe(0);
    expect(studyDaysBetween('2026-11-01', '2026-11-16', DIWALI)).toBe(0); // the whole break
    expect(studyDaysBetween('2026-11-01', '2026-11-16', [])).toBe(10); // what it costs
    expect(studyDaysBetween('2026-10-26', '2026-11-20', DIWALI)).toBe(9); // Mon 26 Oct–Fri 30 Oct + Mon 16–Thu 19 Nov
  });
  it('addStudyDays jumps over a break', () => {
    expect(addStudyDays('2026-10-30', 1, DIWALI)).toBe('2026-11-16'); // Fri → the Monday after Diwali
    expect(addStudyDays('2026-11-05', 1, DIWALI)).toBe('2026-11-16'); // from inside the break
    expect(addStudyDays('2026-10-28', 5, DIWALI)).toBe('2026-11-18');
  });
  it('addOpenDays moves calendar days forward, not counting break days', () => {
    expect(addOpenDays('2026-10-30', 0, DIWALI)).toBe('2026-10-30');
    expect(addOpenDays('2026-10-30', 1, DIWALI)).toBe('2026-10-31'); // Sat is open (just not a study day)
    expect(addOpenDays('2026-10-30', 2, DIWALI)).toBe('2026-11-16');
    expect(addOpenDays('2026-10-30', 9, [])).toBe('2026-11-08');
  });
});
