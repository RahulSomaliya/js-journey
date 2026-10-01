@AGENTS.md

# JS Journey — project notes

## Commands
- test `pnpm test` (vitest) · lint `pnpm lint` · typecheck `npx tsc --noEmit` · build `pnpm build`
- migration file `pnpm db:generate` (offline) · seed `pnpm db:seed` (idempotent upsert) · dev `pnpm dev`

## Structure
- `app/m/[token]` student view · `app/r/[token]` coach view (`?course=js` = history) · `app/api/player/*` Course Player API · `app/api/cron/daily` missed-day email
- `lib/` pure logic (schedule, status, player, feed, stats, overview, journey-view, courses, curriculum, format; `fixtures` = page test data) + `lib/db` (schema, queries; server-only) + `lib/actions` (server actions) + `lib/notify.ts` (after-write side effects)
- `components/` shared (`ui` primitives + icons, `stats-row`, `thirty-days`, `update-item`, `theme-toggle`, `auto-textarea`) + `components/coach` (unread cards, reply, note, plan) + `components/student` (From Rahul, This week, sign-off) · `drizzle/` migrations · `scripts/seed.ts` · `tests/`

## Architecture map
| Where is… | |
|---|---|
| courses + plans | `lib/course-ids.ts` (ids = PG enum), `lib/courses.ts` (registry), `lib/config.ts` (plans) |
| curricula / section ids | `lib/curriculum.ts` — JS 1..21, React 101..131 = 100 + folder number |
| pace (the pill, Due stat, player status, coach email) | `lib/status.ts` `planPace` — the weekly goals (`computePace` only gives the email its "% done") |
| dynamic schedule / finished sections | `lib/schedule.ts` (`buildDynamicSchedule` → `currentSection`, `sectionsFinishedBy`) |
| plan breaks (Diwali) | `ScheduleConfig.breaks` in `lib/config.ts`; study-day math in `lib/date.ts`; `planBreakFor` / `nudgeSkipReason` in `lib/schedule.ts` |
| player contract + validation | `lib/player.ts` (mirror of course-player `shared/types.ts`) |
| player status numbers | `lib/status.ts` (`goal` = this plan week's goal, `sectionDue` = plan-week Fridays) |
| what a new log triggers | `lib/notify.ts` `afterLogWritten` (revalidate + coach email, stuck flagged) |
| v2 updates feed / read state / replies | `lib/feed.ts` (cursor, page assembly) + `lib/db/queries.ts` (`listUpdates`, `getJourneyFeed`, `markUpdatesRead`, `markCoachMessagesRead`, `replyToUpdate`) |
| stats she sees (Today/Streak/Complete/Due/30 days) | `lib/stats.ts` (mirror of course-player `web/src/lib/stats.ts`) from `progress_snapshots`; `lib/overview.ts` + `loadOverview` |
| page data, actions, fixtures for /m and /r | `docs/v2-data-layer.md`; `lib/actions/{log,message}.ts`; `lib/fixtures.ts` |
| what the pages print (pace pill, This week, plan rows, From Rahul, update facts) | `lib/journey-view.ts` (mirrors course-player `lib/week.ts` + `lib/feed.ts`) |
| look: colour tokens, type, motion | `app/globals.css` (port of course-player `web/src/index.css`; its `docs/design.md` is the spec) |
| render /m and /r without a database | `tests/page-queries.ts` (fixture-backed query stand-ins) + `tests/pages.test.ts` |

## Errors & logging
Route handlers return `apiJson({ error }, status)` (`lib/api.ts`, always no-store) and `console.error` with the
session id / course / date; server actions return `{ ok, error }`. Email failures never fail a write (`lib/notify.ts`).

## Failure log
- `.env.local` points at the PRODUCTION Neon DB: `db:push`, `db:seed`, `next dev`/`start` all touch real data. Apply
  migrations as reviewed SQL in ONE transaction — the files have no BEGIN/COMMIT and no IF NOT EXISTS, so a run that
  stops half-way cannot be re-run: Neon SQL Editor `BEGIN;` + file + `COMMIT;`, or `psql "$DATABASE_URL"
  --single-transaction -v ON_ERROR_STOP=1 -f <file>` (header of `drizzle/0003_*.sql`). The old seed's "delete all
  sections" would hit log FKs.
- A player session is ONE row: sections finished mid-session ride in `also_finished_section_ids`. Any "is it
  finished?" read must use `sectionsFinishedBy` — `finishedSection && sectionId` alone misses them.
- The player outbox drops a session for good on ANY 4xx — only return 4xx for input that can never succeed.
- Colours are tokens only (`app/globals.css`): text on `bg-accent` is `text-on-accent` (the dark accent is a light orange —
  white text ≈ 2:1). `tests/theme-contrast.test.ts` pins every text pairing at AA in both themes, keeps the two dark blocks
  identical, and fails on any raw colour (hex, `rgb(`/`oklch(`, Tailwind palette class) in `components/` or `app/`.
- Plan weeks are STUDY weeks: never derive a date as `start + weeks × 7` or count plain weekdays — go through
  `isStudyDay`/`studyDaysBetween`/`addStudyDays` with `plan.breaks` (required arg), or Diwali counts as missed study.
- The feed index must match `ORDER BY created_at DESC, id DESC` exactly: drizzle's `.desc()` emits `DESC NULLS LAST`
  (≠ `DESC` = NULLS FIRST) and the planner silently seq-scans + sorts every row — keep `.nullsFirst()` and `id`
  (`lib/db/schema.ts`). The cursor carries Postgres's microseconds; a JS Date (ms) would skip/repeat rows.
- A session's `progress` never 400s the session (the outbox would drop her note): an unusable snapshot is dropped,
  logged, and answered `progress: "ignored"`. `PUT /api/player/progress` is the strict one.
- Snapshot `takenAt` must stay ≤ server now + 24 h (`SNAPSHOT_FUTURE_MS`, `parseProgressSnapshot`): the upsert is
  newest-wins on HER clock, so one far-future row made every later snapshot "stale" for good, and a takenAt past the
  JS Date range threw inside the upsert (500 → the outbox retried her session forever). Tests pin the clock.
- `lib/stats.ts` mirrors the player's stats rules (STUDY-day streak ≥ 5 min, `<1%`/floor label): change both apps
  together, or Rahul reads a different number than she does. The streak walks `JourneyStatus.studyWeekdays` +
  `planBreaks` (the calendar the player gets): a calendar-day streak reset every weekend and all of Diwali
  (2026-10-01). Never a second weekday list — `STUDY_WEEKDAYS` (`lib/date.ts`) feeds both `isStudyDay` and the status.
- Pace = `lib/status.ts` `planPace` ONLY (the weekly goals): `pace` and `daysDelta` once came from two models
  (prorated `computePace` + the dynamic projection) → a bare "Behind" on an on-plan week. Print it with
  `paceLabel(daysDelta)` (pill AND Due stat — no separate word map); the player's `lib/week.ts` mirrors it.
  The break's "back on" day is `weekView`'s `addDays(end, 1)` (= the player) — no second rule in `lib/stats.ts`.
- `drizzle/0003_*.sql` has HAND-ADDED backfill UPDATEs + header: regenerating the file drops them — re-add both
  (`tests/migration-0003.test.ts` fails without them).
- Dates in a client component must print the same in Node and in her browser: `fmtDate` uses fixed English names (Node's
  ICU says "Sept", Chrome's "Sep" → hydration mismatch) and clock times go through `fmtTime`/`fmtWhen` (IST). Never
  `toLocaleString`/`getHours()` in a page — the server renders in UTC.
- "From Rahul" (`unreadFromRahul`, both apps) = unread replies in the first feed page AND `feed.unreadReplies` (every
  older update with an unread reply) + unread notes. Built from the page alone, a reply Rahul wrote from his history
  was never shown nor marked read while `unreadForStudent` counted it forever. `/m` still fetches the player's 30 and
  shows 5 (`HOME_UPDATES` vs `FEED_LIMIT`); its "Your updates" must list his notes too (`withNotes`) — `/m` marks a
  note read the moment it shows, so a read note rendered nowhere else is lost after one visit.
- `tests/pages.test.ts` renders the real pages with `renderToString`, which cannot render an async component: a page
  awaits its data (or a helper like `jsHistory()`), never returns `<AsyncThing />`.
- `/r` with nothing unread shows ONE line (`caughtUp`): a nudge + "Send her a note" after 2+ silent study days —
  never an "all caught up" card (it topped his page exactly when she had gone quiet).
- One sign-off rule, `canSignOff` (`lib/player.ts`): the player API, `signOffAction` and the web form (starts at 0m,
  Send disabled until time or a note — it started at 1h, so one tap sent an hour she never studied).
