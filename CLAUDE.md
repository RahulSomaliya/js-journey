@AGENTS.md

# JS Journey — project notes

## Commands
- test `pnpm test` (vitest) · lint `pnpm lint` · typecheck `npx tsc --noEmit` · build `pnpm build`
- migration file `pnpm db:generate` (offline) · seed `pnpm db:seed` (idempotent upsert) · dev `pnpm dev`

## Structure
- `app/m/[token]` student view · `app/r/[token]` coach view (`?course=js` = history) · `app/api/player/*` Course Player API · `app/api/cron/daily` missed-day email
- `lib/` pure logic (schedule, status, player, courses, curriculum, format) + `lib/db` (schema, queries; server-only) + `lib/actions` (server actions) + `lib/notify.ts` (after-write side effects)
- `components/student`, `components/coach` · `drizzle/` migrations · `scripts/seed.ts` · `tests/`

## Architecture map
| Where is… | |
|---|---|
| courses + plans | `lib/course-ids.ts` (ids = PG enum), `lib/courses.ts` (registry), `lib/config.ts` (plans) |
| curricula / section ids | `lib/curriculum.ts` — JS 1..21, React 101..131 = 100 + folder number |
| pace / dynamic schedule | `lib/schedule.ts` (`computePace`, `buildDynamicSchedule`, `sectionsFinishedBy`) |
| plan breaks (Diwali) | `ScheduleConfig.breaks` in `lib/config.ts`; study-day math in `lib/date.ts`; `planBreakFor` / `nudgeSkipReason` in `lib/schedule.ts` |
| player contract + validation | `lib/player.ts` (mirror of course-player `shared/types.ts`) |
| player status numbers | `lib/status.ts` |
| what a new log triggers | `lib/notify.ts` `afterLogWritten` (revalidate + coach email) |

## Errors & logging
Route handlers return `apiJson({ error }, status)` (`lib/api.ts`, always no-store) and `console.error` with the
session id / course / date; server actions return `{ ok, error }`. Email failures never fail a write (`lib/notify.ts`).

## Failure log
- `.env.local` points at the PRODUCTION Neon DB: `db:push`, `db:seed`, `next dev`/`start` all touch real data. Apply
  migrations as reviewed SQL (one transaction); the old seed's "delete all sections" would hit log FKs.
- A player session is ONE row: sections finished mid-session ride in `also_finished_section_ids`. Any "is it
  finished?" read must use `sectionsFinishedBy` — `finishedSection && sectionId` alone misses them.
- The player outbox drops a session for good on ANY 4xx — only return 4xx for input that can never succeed.
- Text on a `bg-accent`/`bg-accent-deep` fill is `text-on-accent`, never `text-white`: dark-mode accents are light mint
  (white ≈ 2:1, AA needs 4.5). `tests/theme-contrast.test.ts` fails on any `text-white` in `components/` or `app/`.
- Plan weeks are STUDY weeks: never derive a date as `start + weeks × 7` or count plain weekdays — go through
  `isStudyDay`/`studyDaysBetween`/`addStudyDays` with `plan.breaks` (required arg), or Diwali counts as missed study.
