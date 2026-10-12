import { describe, it, expect } from 'vitest';
import { outlineFor, weekOutline, type WeekOutline } from '@/lib/outline';
import { REACT_CURRICULUM } from '@/lib/curriculum';
import { REACT_PLAN } from '@/lib/config';
import type { LogEntry } from '@/lib/schedule';
import { WEEK1_LOGS, WEEK1_SNAPSHOT } from './helpers';

// The React outline (lib/outline/react-2023.json, generated from the course folder on the SSD) and the
// coach page's plan accordion data: a plan week → its sections grouped by Part → lectures, with her marks.

const outline = outlineFor('react-2023');
if (!outline) throw new Error('the React outline must load');

/** "part:section,section" per group — the shape the accordion renders */
const shape = (w: WeekOutline) => w.groups.map((g) => `${g.part ? `P${g.part.number}` : '-'}:${g.sections.map((s) => s.number).join(',')}`);
const base = { sections: REACT_CURRICULUM, config: REACT_PLAN, logs: [] as LogEntry[], snapshot: null };

describe('outlineFor', () => {
  it('React: 31 sections, 410 lectures, numbered 1..n, the four Part folders carry their part', () => {
    expect(outline.sections).toHaveLength(31);
    expect(outline.sections.reduce((n, s) => n + s.lectures.length, 0)).toBe(410);
    for (const s of outline.sections) expect(s.lectures.map((l) => l.number)).toEqual(s.lectures.map((_, i) => i + 1));
    expect(outline.sections.filter((s) => s.part).map((s) => [s.number, s.part?.number, s.title])).toEqual([
      [2, 1, 'React Fundamentals'], [9, 2, 'Intermediate React'], [15, 3, 'Advanced React + Redux'], [21, 4, 'Professional React Development'],
    ]);
  });
  it('agrees with the curriculum the plan is built on: same numbers, each section within a minute', () => {
    expect(outline.sections.map((s) => s.number)).toEqual(REACT_CURRICULUM.map((s) => s.sortOrder));
    for (const s of outline.sections) {
      const minutes = s.lectures.reduce((sum, l) => sum + l.seconds, 0) / 60;
      const plan = REACT_CURRICULUM.find((c) => c.sortOrder === s.number)?.videoMinutes ?? NaN;
      expect([s.number, Math.abs(minutes - plan) <= 1]).toEqual([s.number, true]);
    }
  });
  it('the finished JS course has none (its pages show no lecture view)', () => {
    expect(outlineFor('js')).toBeNull();
    expect(outlineFor('vue')).toBeNull();
  });
});

describe('weekOutline — what a plan week covers, grouped by Part', () => {
  it('week 1 = 01–05 (04 shown, skipped by the plan); 02 opens Part 1 as its introduction', () => {
    const w = weekOutline(base, 1, outline);
    expect(shape(w)).toEqual(['-:1', 'P1:2,3,4,5']);
    expect(w.groups[1].part).toEqual({ number: 1, title: 'React Fundamentals', projects: 4 });
    const s = w.groups[1].sections;
    expect(s.map((x) => [x.number, x.partIntro, x.skipped, x.optional])).toEqual([
      [2, true, false, false], [3, false, false, false], [4, false, true, true], [5, false, false, false],
    ]);
  });
  it('week 2 = 06–09: Part 1\'s last sections, then Part 2 starts with its introduction', () => {
    expect(shape(weekOutline(base, 2, outline))).toEqual(['P1:6,7,8', 'P2:9']);
  });
  it('the "keep going" week 9 = the section it continues (29); week 10 = 29–31', () => {
    expect(shape(weekOutline(base, 9, outline))).toEqual(['P4:29']);
    expect(shape(weekOutline(base, 10, outline))).toEqual(['P4:29,30,31']);
  });
  it('a section row: its title, length (sum of its lectures) and lectures with kind + seconds', () => {
    const one = weekOutline(base, 1, outline).groups[0].sections[0];
    expect([one.title, one.seconds]).toEqual(['Welcome, Welcome, Welcome!', 1850]);
    expect(one.lectures[3]).toEqual({ number: 4, title: 'Read Before You Start!', kind: 'article', seconds: 0, done: false, current: false });
  });
  it('outside the plan (week 0, week 11) → no groups', () => {
    expect(weekOutline(base, 0, outline).groups).toEqual([]);
    expect(weekOutline(base, 11, outline).groups).toEqual([]);
  });
});

describe('weekOutline marks — her latest snapshot (doneLectures, current, sectionsDone) ∪ the logs', () => {
  const o = { ...base, logs: WEEK1_LOGS, snapshot: WEEK1_SNAPSHOT };
  it('today\'s case: 01 not done (one article unticked) with its four done lectures ticked; 02/03/05 done', () => {
    const w = weekOutline(o, 1, outline);
    expect(w.lectureMarks).toBe(true);
    const rows = w.groups.flatMap((g) => g.sections);
    expect(rows.map((s) => [s.number, s.done, s.current])).toEqual([[1, false, false], [2, true, false], [3, true, false], [4, false, false], [5, true, false]]);
    expect(rows[0].lectures.map((l) => l.done)).toEqual([true, true, true, false, true]);
    expect(rows[3].skipped).toBe(true); // skipped and not finished
  });
  it('week 2: 07 is the current section with lecture 1 current, nothing in it done yet', () => {
    const rows = weekOutline(o, 2, outline).groups.flatMap((g) => g.sections);
    expect(rows.map((s) => [s.number, s.done, s.current])).toEqual([[6, true, false], [7, false, true], [8, false, false], [9, false, false]]);
    const seven = rows[1];
    expect(seven.lectures.filter((l) => l.current).map((l) => l.number)).toEqual([1]);
    expect(seven.lectures.some((l) => l.done)).toBe(false);
  });
  it('a section only the logs finished is done too (a session said so; the snapshot is older)', () => {
    const logs: LogEntry[] = [...WEEK1_LOGS, { id: 'x', studyDate: '2026-10-12', minutes: 90, sectionId: 101, finishedSection: true }];
    expect(weekOutline({ ...o, logs }, 1, outline).groups[0].sections[0].done).toBe(true);
  });
  it('a skipped section she finished anyway is done, never "skipped"', () => {
    const snap = { ...WEEK1_SNAPSHOT, sectionsDone: [2, 3, 4, 5, 6] };
    const four = weekOutline({ ...o, snapshot: snap }, 1, outline).groups[1].sections[2];
    expect([four.number, four.done, four.skipped]).toEqual([4, true, false]);
  });
  it('an older player (no doneLectures): sections still ✓ from sectionsDone, lectures carry no marks', () => {
    const w = weekOutline({ ...o, snapshot: { ...WEEK1_SNAPSHOT, doneLectures: undefined } }, 2, outline);
    expect(w.lectureMarks).toBe(false);
    const rows = w.groups.flatMap((g) => g.sections);
    expect(rows.map((s) => [s.number, s.done, s.current])).toEqual([[6, true, false], [7, false, true], [8, false, false], [9, false, false]]);
    expect(rows.flatMap((s) => s.lectures).some((l) => l.done || l.current)).toBe(false);
  });
  it('no snapshot at all: the logs alone mark sections; no current, no lecture marks', () => {
    const w = weekOutline({ ...base, logs: WEEK1_LOGS }, 1, outline);
    expect(w.lectureMarks).toBe(false);
    expect(w.groups.flatMap((g) => g.sections).map((s) => [s.number, s.done, s.current])).toEqual([
      [1, false, false], [2, true, false], [3, true, false], [4, false, false], [5, true, false],
    ]);
  });
});
