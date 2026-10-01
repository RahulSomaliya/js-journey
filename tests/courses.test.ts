import { describe, it, expect } from 'vitest';
import {
  ACTIVE_COURSE, COURSE_IDS, getCourse, isCourseId, sectionIdFor, sectionNumberOf, courseStage,
} from '@/lib/courses';
import { JS_PLAN, REACT_PLAN, TIME_ZONE } from '@/lib/config';
import {
  contentMinutesPerWeek, totalWeeks, buildMilestones, coreContentMinutes, planTimeline, breakStudyDays,
} from '@/lib/schedule';
import { diffDays } from '@/lib/date';
import { CURRICULUM, REACT_CURRICULUM } from '@/lib/curriculum';

describe('course registry', () => {
  it('knows js (completed) and react-2023 (active)', () => {
    expect(COURSE_IDS).toEqual(['js', 'react-2023']);
    expect(ACTIVE_COURSE).toBe('react-2023');
    expect(getCourse('js').status).toBe('completed');
    expect(getCourse('react-2023').status).toBe('active');
    expect(getCourse('js').curriculum).toBe(CURRICULUM);
    expect(getCourse('react-2023').curriculum).toBe(REACT_CURRICULUM);
  });
  it('isCourseId guards unknown values', () => {
    expect(isCourseId('react-2023')).toBe(true);
    expect(isCourseId('js')).toBe(true);
    expect(isCourseId('vue')).toBe(false);
    expect(isCourseId(undefined)).toBe(false);
    expect(isCourseId(7)).toBe(false);
  });
  it('maps the player section number to the section id and back', () => {
    expect(sectionIdFor('react-2023', 7)).toBe(107);
    expect(sectionIdFor('react-2023', 31)).toBe(131);
    expect(sectionIdFor('react-2023', 32)).toBeNull();
    expect(sectionIdFor('react-2023', 0)).toBeNull();
    expect(sectionIdFor('js', 6)).toBe(6);
    expect(sectionNumberOf('react-2023', 107)).toBe(7);
    expect(sectionNumberOf('react-2023', 7)).toBeNull(); // a JS id is not a React section
  });
  it('React stages are the course’s own Parts; JS keeps its week phases', () => {
    const react = (n: number) => REACT_CURRICULUM.find((s) => s.sortOrder === n)!;
    expect(courseStage('react-2023', 1, react(1))).toEqual({ n: 1, label: 'Part', name: 'React Fundamentals' });
    expect(courseStage('react-2023', 3, react(12))).toEqual({ n: 2, label: 'Part', name: 'Intermediate React' });
    expect(courseStage('react-2023', 5, react(15))).toEqual({ n: 3, label: 'Part', name: 'Advanced React + Redux' });
    expect(courseStage('react-2023', 9, react(31))).toEqual({ n: 4, label: 'Part', name: 'Professional React Development' });
    expect(courseStage('react-2023', 10, null)).toBeNull();
    expect(courseStage('js', 7, null)).toEqual({ n: 3, label: 'Phase', name: 'Real apps & data' });
  });
});

describe('plans', () => {
  it('JS plan is frozen history: 2.5×, 22 Jun → target 25 Sep, deadline 2 Oct, no breaks', () => {
    expect(JS_PLAN).toEqual({
      startDate: '2026-06-22', dailyHours: 2.5, studyDaysPerWeek: 5, multiplier: 2.5, graceWeeks: 1, timeZone: TIME_ZONE,
      breaks: [],
    });
    expect(planTimeline(CURRICULUM, JS_PLAN)).toEqual({ weeks: 14, target: '2026-09-25', deadline: '2026-10-02' });
  });
  it('React plan: Mon 5 Oct 2026, 2.5 h/day × 5, 1.75× watch time, 1 grace week, Diwali break 1–15 Nov', () => {
    expect(REACT_PLAN).toEqual({
      startDate: '2026-10-05', dailyHours: 2.5, studyDaysPerWeek: 5, multiplier: 1.75, graceWeeks: 1, timeZone: 'Asia/Kolkata',
      breaks: [{ label: 'Diwali', start: '2026-11-01', end: '2026-11-15' }],
    });
    expect(getCourse('react-2023').plan).toBe(REACT_PLAN);
  });
  it('the Diwali break is 15 calendar days and costs 10 study days (two full Mon–Fri weeks)', () => {
    const [diwali] = REACT_PLAN.breaks;
    expect(diffDays(diwali.start, diwali.end) + 1).toBe(15);
    expect(breakStudyDays(diwali)).toBe(10);
  });
  it('React timeline: 429 content-min/week → 10 study weeks; Diwali pushes target to Fri 25 Dec, deadline Fri 1 Jan 2027', () => {
    expect(contentMinutesPerWeek(REACT_PLAN)).toBe(429);
    expect(totalWeeks(REACT_CURRICULUM, REACT_PLAN)).toBe(10);
    expect(planTimeline(REACT_CURRICULUM, REACT_PLAN)).toEqual({ weeks: 10, target: '2026-12-25', deadline: '2027-01-01' });
    // without the break it would be the old Fri 11 Dec / Fri 18 Dec
    expect(planTimeline(REACT_CURRICULUM, { ...REACT_PLAN, breaks: [] })).toEqual({ weeks: 10, target: '2026-12-11', deadline: '2026-12-18' });
    // study budget = 3916 × 1.75 = 6853 min ≈ 114.2 h (a break adds calendar time, not study time)
    expect(Math.round(coreContentMinutes(REACT_CURRICULUM) * REACT_PLAN.multiplier)).toBe(6853);
  });
  it('a break inside the grace week pushes the deadline too', () => {
    const graceBreak = { ...REACT_PLAN, breaks: [{ label: 'Christmas', start: '2026-12-14', end: '2026-12-18' }] };
    expect(planTimeline(REACT_CURRICULUM, graceBreak)).toEqual({ weeks: 10, target: '2026-12-11', deadline: '2026-12-25' });
  });
  it('React weekly section goals (buildMilestones), pinned — no goal falls due inside Diwali', () => {
    const ms = buildMilestones(REACT_CURRICULUM, REACT_PLAN).map((m) => [m.week, m.dueDate, m.cumulativeContentMinutes, m.throughSectionId]);
    expect(ms).toEqual([
      [1, '2026-10-09', 429, 105],
      [2, '2026-10-16', 858, 109],
      [3, '2026-10-23', 1287, 112],
      [4, '2026-10-30', 1716, 116],
      // Diwali break Sun 1 – Sun 15 Nov: no study week
      [5, '2026-11-20', 2145, 118],
      [6, '2026-11-27', 2574, 122],
      [7, '2026-12-04', 3003, 125],
      [8, '2026-12-11', 3432, 128],
      [9, '2026-12-18', 3861, 128], // §29 alone is 7.9 h, so week 9 closes no new section
      [10, '2026-12-25', 3916, 131],
    ]);
  });
});
