# Mansi's JS Journey

A small, warm web app that helps Mansi log her daily progress through
[Jonas Schmedtmann's *Complete JavaScript Course*](https://www.udemy.com/course/the-complete-javascript-course/),
and helps her coach (Rahul) review it honestly against a fixed, date-anchored schedule.

- **Student view** (`/m/<token>`) — a ~15-second daily check-in: tap the section, set hours, add a note. Streaks, gentle encouragement, and notes from your coach.
- **Coach view** (`/r/<token>`) — content % vs effort hours, pace status, projected finish, a study heatmap, and a heads-up when she logs or misses a day.

**Plan:** 2.5 h/day × 5 days, 2.5× conservatism → 14 weeks. Study starts **22 Jun 2026**; course-complete target **25 Sep 2026**; deadline **2 Oct 2026**.

## Stack

Next.js (App Router) · Neon Postgres · Drizzle ORM · Vercel · Resend · pnpm.

## Docs

- Design spec: [`docs/superpowers/specs/2026-06-15-mansi-js-journey-design.md`](docs/superpowers/specs/2026-06-15-mansi-js-journey-design.md)

> Personal project. Access is by secret link; there are no public accounts.
