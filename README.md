# Mansi's JS Journey

A small, warm web app that tracks Mansi's study — first
[Jonas Schmedtmann's *Complete JavaScript Course*](https://www.udemy.com/course/the-complete-javascript-course/) (done ✓),
now his *Ultimate React Course* (2023) — and lets her coach (Rahul) review it honestly against a date-anchored plan.

- **Student view** (`/m/<token>`) — today's focus, her study sessions (Course Player sessions appear on their own), a collapsed manual check-in for study away from the player, streak, plan, roadmap. Finished courses shrink to a badge.
- **Coach view** (`/r/<token>`, `?course=js` for history) — pace vs plan, effort vs the plan multiplier, per-session detail (player vs manual, lectures completed, mood/note), heatmap, curriculum.
- **Course Player API** (`/api/player/*`) — the local Course Player app posts finished study sessions and reads her status, server-to-server with `Authorization: Bearer <student token>`.

## Plans

| Course | Start | Pace | Multiplier | Target | Deadline |
|---|---|---|---|---|---|
| `js` — Complete JavaScript (finished) | Mon 22 Jun 2026 | 2.5 h/day × 5 | 2.5× | Fri 25 Sep | Fri 2 Oct |
| `react-2023` — Ultimate React (active) | Mon 5 Oct 2026 | 2.5 h/day × 5 | 1.75× | Fri 25 Dec | Fri 1 Jan 2027 |

React: 30 counted sections (every folder except §04 *Review of Essential JavaScript*) = 3916 video-min (65.3 h) → 114.2 study-hours → 10 study weeks + 1 grace week.
Plan breaks (`ScheduleConfig.breaks`) are days with no study: **Diwali, Sun 1 – Sun 15 Nov 2026** (10 study days) moves the
target and deadline two weeks later (from Fri 11 / Fri 18 Dec). Pace, due dates, streak and the daily no-log email skip
break days. Constants: `lib/config.ts`; curricula: `lib/curriculum.ts`; pinned in `tests/courses.test.ts`.

## Course Player API

Contract types mirror `~/Developer/course-player/shared/types.ts` (`lib/player.ts`) — change both together.

- `POST /api/player/sessions` — body `JourneySession`. 201 stored · 200 duplicate (dedup on `session.id`, unique `log_entries.external_id`) · 400 invalid (message names the field) · 401 bad token · 500 transient (player retries). Section `NN` of the course maps to section id `100 + NN`.
- `GET /api/player/status?course=react-2023` — `JourneyStatus` (incl. `planBreak`: the break in progress, else the next within 14 days, else null). 400 without `course`, 404 for an unknown course, 401 bad token. Responses are `Cache-Control: no-store`.

## Stack

Next.js (App Router) · Neon Postgres · Drizzle ORM · Vercel · Resend · pnpm.

## Docs

- Design spec: [`docs/superpowers/specs/2026-06-15-mansi-js-journey-design.md`](docs/superpowers/specs/2026-06-15-mansi-js-journey-design.md)

> Personal project. Access is by secret link; there are no public accounts.
