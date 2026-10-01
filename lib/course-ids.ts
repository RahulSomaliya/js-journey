// Dependency-free on purpose: lib/db/schema.ts builds the Postgres enum from this list,
// and drizzle-kit / scripts/seed.ts load the schema without the '@/' path alias.
// Adding a course = append here + `pnpm db:generate` (ALTER TYPE "course_id" ADD VALUE).
// The ids are the Course Player's Course.id (course-player/shared/types.ts).
export const COURSE_IDS = ['js', 'react-2023'] as const;
export type CourseId = (typeof COURSE_IDS)[number];
