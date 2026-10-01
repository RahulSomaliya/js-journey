import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' }); // standalone script: load Next's .env.local explicitly
loadEnv();
// relative imports: tsx (esbuild) does not resolve tsconfig '@/' path aliases at runtime
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { sections } from '../lib/db/schema';
import { CURRICULUM, REACT_CURRICULUM } from '../lib/curriculum';
import type { Section } from '../lib/schedule';
import type { CourseId } from '../lib/course-ids';

// Idempotent — safe to re-run against the live DB (run AFTER migration 0002, which
// adds sections.course). Never DELETEs: log_entries / messages reference sections by
// FK, so the old "delete all, re-insert" seed would fail (or orphan history).
//  - JS (finished course): insert only if missing — existing rows are history and are
//    left exactly as they are, even if lib/curriculum.ts drifts.
//  - React (active course): upsert — re-running after a curriculum fix updates titles,
//    minutes, kinds in place (ids are stable: 100 + folder number).
const rows = (course: CourseId, list: Section[]) =>
  list.map((s) => ({ id: s.id, course, title: s.title, videoMinutes: s.videoMinutes, kind: s.kind, sortOrder: s.sortOrder }));

async function main() {
  // neon-http has no interactive transactions; db.batch runs these atomically
  await db.batch([
    db.insert(sections).values(rows('js', CURRICULUM)).onConflictDoNothing({ target: sections.id }),
    db.insert(sections).values(rows('react-2023', REACT_CURRICULUM)).onConflictDoUpdate({
      target: sections.id,
      set: {
        course: sql`excluded.course`,
        title: sql`excluded.title`,
        videoMinutes: sql`excluded.video_minutes`,
        kind: sql`excluded.kind`,
        sortOrder: sql`excluded.sort_order`,
      },
    }),
  ]);
  console.log(`Seeded sections: ${CURRICULUM.length} JS (insert-if-missing), ${REACT_CURRICULUM.length} React (upsert).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('seed failed', e); process.exit(1); });
