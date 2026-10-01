import type { ScheduleConfig, Section } from '@/lib/schedule';
import { CURRICULUM, REACT_CURRICULUM } from '@/lib/curriculum';
import { JS_PLAN, REACT_PLAN } from '@/lib/config';

import { COURSE_IDS, type CourseId } from '@/lib/course-ids';

// The course registry. The id list itself lives in lib/course-ids.ts (it is also the
// Postgres enum); the player sends `course: "react-2023"` and asks `?course=react-2023`.
export { COURSE_IDS, type CourseId };

/** the course both views open on, and the one manual check-ins log against */
export const ACTIVE_COURSE: CourseId = 'react-2023';

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
