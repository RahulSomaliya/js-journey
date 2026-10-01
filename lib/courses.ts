import type { ScheduleConfig, Section } from '@/lib/schedule';
import { phaseForWeek } from '@/lib/schedule';
import { CURRICULUM, REACT_CURRICULUM } from '@/lib/curriculum';
import { JS_PLAN, REACT_PLAN } from '@/lib/config';

import { COURSE_IDS, type CourseId } from '@/lib/course-ids';

// The course registry. The id list itself lives in lib/course-ids.ts (it is also the
// Postgres enum); the player sends `course: "react-2023"` and asks `?course=react-2023`.
export { COURSE_IDS, type CourseId };

/** the course both views open on, and the one manual check-ins log against */
export const ACTIVE_COURSE: CourseId = 'react-2023';

export interface CourseStage { n: number; label: 'Phase' | 'Part'; name: string; }

export interface CourseDef {
  id: CourseId;
  title: string;
  shortTitle: string;
  status: 'completed' | 'active';
  plan: ScheduleConfig;
  /** seed data — the DB `sections` rows (scripts/seed.ts) are what the pages read */
  curriculum: Section[];
}

const COURSES: Record<CourseId, CourseDef> = {
  js: {
    id: 'js',
    title: 'The Complete JavaScript Course',
    shortTitle: 'JavaScript',
    status: 'completed',
    plan: JS_PLAN,
    curriculum: CURRICULUM,
  },
  'react-2023': {
    id: 'react-2023',
    title: 'The Ultimate React Course',
    shortTitle: 'React',
    status: 'active',
    plan: REACT_PLAN,
    curriculum: REACT_CURRICULUM,
  },
};

export function getCourse(id: CourseId): CourseDef {
  return COURSES[id];
}

export function isCourseId(x: unknown): x is CourseId {
  return typeof x === 'string' && (COURSE_IDS as readonly string[]).includes(x);
}

// A section's own number in its course (React folder "07 …" → 7). sortOrder carries
// it for both courses (JS: sortOrder = id; React: id = 100 + sortOrder).
export function sectionIdFor(course: CourseId, sectionNumber: number): number | null {
  return COURSES[course].curriculum.find((s) => s.sortOrder === sectionNumber)?.id ?? null;
}
export function sectionNumberOf(course: CourseId, sectionId: number): number | null {
  return COURSES[course].curriculum.find((s) => s.id === sectionId)?.sortOrder ?? null;
}

// "Part 2 - Intermediate React (2 Projects)" → [2, "Intermediate React"]
const PART_RE = /^Part (\d+) - (.+?)(?: \(\d+ Projects?\))?$/;

// Where she is in the course, in the course's own vocabulary: JS uses the plan's
// week-based phases; React uses its "Part N" divider folders (by current section).
export function courseStage(course: CourseId, week: number, current: Section | null): CourseStage | null {
  if (course === 'js') {
    const p = phaseForWeek(week);
    return p ? { n: p.n, label: 'Phase', name: p.name } : null;
  }
  if (!current) return null;
  const parts = COURSES[course].curriculum
    .map((s) => ({ s, m: PART_RE.exec(s.title) }))
    .filter((x): x is { s: Section; m: RegExpExecArray } => x.m !== null);
  if (parts.length === 0) return null;
  // sections before the first divider (§01 Welcome) belong to Part 1
  const hit = [...parts].reverse().find((p) => p.s.sortOrder <= current.sortOrder) ?? parts[0];
  return { n: Number(hit.m[1]), label: 'Part', name: hit.m[2] };
}
