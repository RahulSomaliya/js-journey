import 'dotenv/config';
// relative imports: tsx (esbuild) does not resolve tsconfig '@/' path aliases at runtime
import { db } from '../lib/db';
import { sections } from '../lib/db/schema';
import { CURRICULUM } from '../lib/curriculum';

async function main() {
  // neon-http has no interactive transactions; db.batch runs these atomically
  await db.batch([
    db.delete(sections),
    db.insert(sections).values(
      CURRICULUM.map((s) => ({ id: s.id, title: s.title, videoMinutes: s.videoMinutes, kind: s.kind, sortOrder: s.sortOrder })),
    ),
  ]);
  console.log(`Seeded ${CURRICULUM.length} sections.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
