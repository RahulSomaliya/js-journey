# Dynamic Milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed calendar-Friday milestones with dynamic, progress-anchored section deadlines + a live "X days ahead/behind" projection, on both the student and coach views.

**Architecture:** One pure function `buildDynamicSchedule(sections, logs, config, today)` computes the anchor (last completion), per-section dynamic due dates (study-days forward), the projected finish, and the days-delta. Every consumer — student "next checkpoint" + buffer badge, coach roadmap dates, "This week" card — just renders that object. `buildCurriculumRows` is refactored to read it.

**Tech Stack:** Next.js 16.2.9 (App Router, RSC), React 19, Tailwind v4 (CSS-var tokens), Vitest, pnpm.

## Global Constraints

- **Counting unit:** study-days (Mon–Fri), via a new `addStudyDays`. Never raw calendar days for budgets.
- **`perStudyDay` = `contentMinutesPerWeek(config) / config.studyDaysPerWeek`** (= 60 at the live plan).
- **`daysDelta` sign:** `diffDays(projectedFinish, originalTarget)` → `+` ahead, `−` behind, `0` on track. (Calendar-day gap between the two dates — the intuitive "finish N days earlier".)
- **Honest-when-behind:** if `today > currentDueAtAnchor`, re-anchor the projection to `today`.
- **Tokens only, never hardcoded colors** (`--accent`, `--warn`, `--ink`, …). Desktop-only stands.
- **No DB/schema change.** Pure derivation from existing logs.
- **Keep `buildMilestones`/`WeeklyMilestone`** (and their tests) — they still derive nothing the UI needs after this, but removing them is out of scope; just stop importing `buildMilestones` in the pages.
- **Next 16 is not the Next you know** (`AGENTS.md`): follow existing patterns in `components/**` and `app/**`.
- **Never bypass hooks** (`--no-verify`/`--no-gpg-sign`). The pre-commit hook runs `next build`; build-before-commit is automatic.
- **Commits gated on Rahul's explicit approval** (batch-approve at checkpoints).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `lib/date.ts` | add `addStudyDays(iso, n)` | **Modify** |
| `tests/date.test.ts` | `addStudyDays` cases | **Modify** |
| `lib/schedule.ts` | add `DynamicSchedule` + `buildDynamicSchedule`; refactor `buildCurriculumRows` (`targetFriday`→`targetDate`, takes `dyn`) | **Modify** |
| `tests/schedule.test.ts` | `buildDynamicSchedule` cases; update `buildCurriculumRows` cases | **Modify** |
| `components/coach/curriculum.tsx` | `r.targetFriday` → `r.targetDate` | **Modify** |
| `components/coach/this-week.tsx` | render dynamic deadline + days-delta (takes `dyn`) | **Modify** |
| `app/r/[token]/page.tsx` | compute `dyn`; wire roadmap + ThisWeek | **Modify** |
| `components/student/journey-stats.tsx` | dynamic next-checkpoint + projected finish + buffer badge (takes `dyn`) | **Modify** |
| `app/m/[token]/page.tsx` | compute `dyn`; wire roadmap + JourneyStats | **Modify** |

---

## Task 0: Branch + preserve the uncommitted typing-effect change

The typing-effect note (`typing-text.tsx`, `coach-note-card.tsx`, `globals.css`) is uncommitted on `feat/coach-view-refactor-lessons` and was never merged. Carry it onto a fresh branch as its own commit so it's not lost and the milestone commits stay clean.

- [ ] **Step 1: Create the branch (uncommitted changes follow checkout)**

Run: `git checkout -b feat/dynamic-milestones`
Expected: "Switched to a new branch 'feat/dynamic-milestones'"; `git status` still shows the typing-text changes.

- [ ] **Step 2: Commit the typing-effect change (hook builds)**

```bash
git add components/student/typing-text.tsx components/student/coach-note-card.tsx app/globals.css
git commit -m "feat: typing effect on the coach note (student view)"
```
Expected: "✅ Build passed." then the commit.

- [ ] **Step 3: Commit the design spec**

```bash
git add docs/superpowers/specs/2026-06-29-dynamic-milestones-design.md
git commit -m "docs: dynamic milestones design spec"
```

---

## Task 1: `addStudyDays` helper

**Files:**
- Modify: `lib/date.ts` (append after `weekdaysBetween`, ~line 34)
- Modify: `tests/date.test.ts`

**Interfaces:**
- Consumes: existing `addDays`, `isWeekend`.
- Produces: `export function addStudyDays(iso: string, n: number): string` — returns the ISO date `n` study-days (Mon–Fri) forward; `n = 0` returns `iso` unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `tests/date.test.ts` (import `addStudyDays` from `@/lib/date`):

```ts
describe('addStudyDays', () => {
  it('returns the same date for n = 0', () => {
    expect(addStudyDays('2026-06-26', 0)).toBe('2026-06-26');
  });
  it('skips the weekend: Friday + 1 study-day = Monday', () => {
    expect(addStudyDays('2026-06-26', 1)).toBe('2026-06-29'); // Fri → Mon
  });
  it('Monday + 4 study-days = same-week Friday', () => {
    expect(addStudyDays('2026-06-22', 4)).toBe('2026-06-26');
  });
  it('Friday + 5 study-days = next Friday', () => {
    expect(addStudyDays('2026-06-26', 5)).toBe('2026-07-03');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/date.test.ts`
Expected: FAIL — `addStudyDays is not a function`.

- [ ] **Step 3: Implement**

Append to `lib/date.ts`:

```ts
// Advance n study-days (Mon–Fri) forward from an ISO date. n = 0 returns iso.
export function addStudyDays(iso: string, n: number): string {
  let d = iso;
  let added = 0;
  while (added < n) {
    d = addDays(d, 1);
    if (!isWeekend(d)) added += 1;
  }
  return d;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test tests/date.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/date.ts tests/date.test.ts
git commit -m "feat: addStudyDays date helper"
```

---

## Task 2: `buildDynamicSchedule`

**Files:**
- Modify: `lib/schedule.ts` (add after `sectionEffortMinutes`, before `buildCurriculumRows`)
- Modify: `tests/schedule.test.ts`

**Interfaces:**
- Consumes: `coreSections`, `finishedSectionIds`, `contentMinutesPerWeek`, `totalWeeks`, `fridayOfWeek` (already imported), `diffDays` (already imported), `addStudyDays` (Task 1 — add to the date import).
- Produces:
  ```ts
  export interface DynamicSchedule {
    anchorDate: string;
    currentSection: Section | null;
    currentDueDate: string | null;
    isCurrentOverdue: boolean;
    projectedFinishDate: string;
    originalTargetDate: string;
    daysDelta: number;
    perSectionDue: Record<number, string>;
  }
  export function buildDynamicSchedule(
    sections: Section[], logs: LogEntry[], config: ScheduleConfig, today: string,
  ): DynamicSchedule
  ```

- [ ] **Step 1: Write the failing tests**

Add to `tests/schedule.test.ts` (add `buildDynamicSchedule` to the `@/lib/schedule` import; add `addStudyDays` to the existing `@/lib/date` import if present, else import it):

```ts
import { addStudyDays } from '@/lib/date';

describe('buildDynamicSchedule', () => {
  it('not started: current is S1, due is start + ceil(24/60)=1 study-day, ~on track', () => {
    const dyn = buildDynamicSchedule(CURRICULUM, [], CFG, '2026-06-22');
    expect(dyn.currentSection?.id).toBe(1);
    expect(dyn.anchorDate).toBe('2026-06-22');
    expect(dyn.currentDueDate).toBe(addStudyDays('2026-06-22', 1));
    expect(dyn.isCurrentOverdue).toBe(false);
    expect(Math.abs(dyn.daysDelta)).toBeLessThanOrEqual(2);
  });

  it('finished S1 & S2 early: current is S3, due anchored to last completion, ahead', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-24', minutes: 24, sectionId: 1, finishedSection: true },
      { id: 'b', studyDate: '2026-06-26', minutes: 300, sectionId: 2, finishedSection: true },
    ];
    const dyn = buildDynamicSchedule(CURRICULUM, logs, CFG, '2026-06-29');
    expect(dyn.currentSection?.id).toBe(3);
    expect(dyn.anchorDate).toBe('2026-06-26'); // latest completion
    // S3 = 270 video-min / 60 per study-day = 4.5 → ceil 5 study-days from the anchor
    expect(dyn.currentDueDate).toBe(addStudyDays('2026-06-26', 5));
    expect(dyn.isCurrentOverdue).toBe(false);
    expect(dyn.daysDelta).toBeGreaterThan(0); // ahead of the original target
  });

  it('idle past the deadline re-anchors to today and reports behind', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-24', minutes: 24, sectionId: 1, finishedSection: true },
    ];
    const dyn = buildDynamicSchedule(CURRICULUM, logs, CFG, '2026-08-15'); // long after S2 was due
    expect(dyn.currentSection?.id).toBe(2);
    expect(dyn.isCurrentOverdue).toBe(true);
    expect(dyn.currentDueDate).toBe(addStudyDays('2026-08-15', 5)); // fresh, from today
    expect(dyn.daysDelta).toBeLessThan(0); // behind
  });

  it('all core finished: no current section, finish = last completion', () => {
    const logs: LogEntry[] = CURRICULUM.filter((s) => s.kind === 'core').map((s, i) => ({
      id: `f${s.id}`, studyDate: '2026-07-10', minutes: s.videoMinutes, sectionId: s.id, finishedSection: true,
    }));
    const dyn = buildDynamicSchedule(CURRICULUM, logs, CFG, '2026-07-11');
    expect(dyn.currentSection).toBeNull();
    expect(dyn.currentDueDate).toBeNull();
    expect(dyn.projectedFinishDate).toBe('2026-07-10');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/schedule.test.ts`
Expected: FAIL — `buildDynamicSchedule is not a function`.

- [ ] **Step 3: Implement**

Add `addStudyDays` to the date import at the top of `lib/schedule.ts`:
```ts
import { addDays, addStudyDays, diffDays, fridayOfWeek, isWeekend, weekdaysBetween } from '@/lib/date';
```

Insert before `buildCurriculumRows`:

```ts
export interface DynamicSchedule {
  anchorDate: string;
  currentSection: Section | null;
  currentDueDate: string | null;
  isCurrentOverdue: boolean;
  projectedFinishDate: string;
  originalTargetDate: string;
  daysDelta: number;
  perSectionDue: Record<number, string>;
}

// Dynamic, progress-anchored schedule: deadlines counted forward (in study-days)
// from the date she finished her last section, crediting time banked early — and
// re-anchored to today (honest "behind") once a section's deadline has passed.
export function buildDynamicSchedule(
  sections: Section[],
  logs: LogEntry[],
  config: ScheduleConfig,
  today: string,
): DynamicSchedule {
  const core = coreSections(sections);
  const done = finishedSectionIds(logs);
  const perStudyDay = contentMinutesPerWeek(config) / config.studyDaysPerWeek;
  const originalTargetDate = fridayOfWeek(config.startDate, totalWeeks(sections, config));

  const finishedDates = logs
    .filter((l) => l.finishedSection && l.sectionId != null)
    .map((l) => l.studyDate);
  const anchorDate = finishedDates.length
    ? finishedDates.reduce((a, b) => (a > b ? a : b))
    : config.startDate;

  const remaining = core.filter((s) => !done.has(s.id));
  const current = remaining[0] ?? null;

  if (!current) {
    return {
      anchorDate,
      currentSection: null,
      currentDueDate: null,
      isCurrentOverdue: false,
      projectedFinishDate: anchorDate,
      originalTargetDate,
      daysDelta: diffDays(anchorDate, originalTargetDate),
      perSectionDue: {},
    };
  }

  const currentDueAtAnchor = addStudyDays(anchorDate, Math.ceil(current.videoMinutes / perStudyDay));
  const isCurrentOverdue = today > currentDueAtAnchor;
  const projAnchor = isCurrentOverdue ? today : anchorDate;

  const perSectionDue: Record<number, string> = {};
  let cum = 0;
  for (const s of remaining) {
    cum += s.videoMinutes;
    perSectionDue[s.id] = addStudyDays(projAnchor, Math.ceil(cum / perStudyDay));
  }

  const projectedFinishDate = perSectionDue[remaining[remaining.length - 1].id];
  return {
    anchorDate,
    currentSection: current,
    currentDueDate: perSectionDue[current.id],
    isCurrentOverdue,
    projectedFinishDate,
    originalTargetDate,
    daysDelta: diffDays(projectedFinishDate, originalTargetDate),
    perSectionDue,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test tests/schedule.test.ts`
Expected: PASS (existing suite + 4 new cases).

- [ ] **Step 5: Commit**

```bash
git add lib/schedule.ts tests/schedule.test.ts
git commit -m "feat: buildDynamicSchedule — progress-anchored deadlines + projection"
```

---

## Task 3: Refactor `buildCurriculumRows` to use the dynamic schedule

**Files:**
- Modify: `lib/schedule.ts` (`CurriculumRow` + `buildCurriculumRows`)
- Modify: `tests/schedule.test.ts` (the `buildCurriculumRows` describe block, ~lines 117–149)
- Modify: `components/coach/curriculum.tsx` (lines 87–88)

**Interfaces:**
- Consumes: `DynamicSchedule` (Task 2), `finishedSectionIds`, `sectionEffortMinutes`.
- Produces: `CurriculumRow` with field **`targetDate`** (renamed from `targetFriday`); `buildCurriculumRows(sections, logs, dyn, today)`.

- [ ] **Step 1: Update the tests to the new signature/field**

Replace the `buildCurriculumRows` describe block in `tests/schedule.test.ts` with:

```ts
describe('buildCurriculumRows', () => {
  it('marks finished done, current in_progress, rest upcoming', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-22', minutes: 24, sectionId: 1, finishedSection: true },
      { id: 'b', studyDate: '2026-06-23', minutes: 60, sectionId: 2, finishedSection: false },
    ];
    const dyn = buildDynamicSchedule(CURRICULUM, logs, CFG, '2026-06-24');
    const rows = buildCurriculumRows(CURRICULUM, logs, dyn, '2026-06-24');
    const byId = Object.fromEntries(rows.map((r) => [r.section.id, r]));
    expect(byId[1].status).toBe('done');
    expect(byId[2].status).toBe('in_progress');
    expect(byId[3].status).toBe('upcoming');
    expect(byId[2].targetDate).toBe(dyn.currentDueDate); // current section's dynamic date
  });
  it('gives bonus/skip sections a null targetDate', () => {
    const dyn = buildDynamicSchedule(CURRICULUM, [], CFG, '2026-06-24');
    const rows = buildCurriculumRows(CURRICULUM, [], dyn, '2026-06-24');
    expect(rows.find((r) => r.section.id === 4)!.targetDate).toBeNull(); // bonus
    expect(rows.find((r) => r.section.id === 6)!.targetDate).toBeNull(); // skip
  });
  it('returns one row per section, in sortOrder', () => {
    const dyn = buildDynamicSchedule(CURRICULUM, [], CFG, '2026-06-24');
    const rows = buildCurriculumRows(CURRICULUM, [], dyn, '2026-06-24');
    expect(rows).toHaveLength(CURRICULUM.length);
    expect(rows.map((r) => r.section.id)).toEqual(CURRICULUM.map((s) => s.id));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/schedule.test.ts`
Expected: FAIL — `targetDate` undefined / `buildCurriculumRows` arity mismatch.

- [ ] **Step 3: Refactor the function + type**

In `lib/schedule.ts`, change `CurriculumRow`:
```ts
export interface CurriculumRow {
  section: Section;
  status: SectionStatus;
  minutesLogged: number;
  targetDate: string | null;
}
```

Replace `buildCurriculumRows`:
```ts
export function buildCurriculumRows(
  sections: Section[],
  logs: LogEntry[],
  dyn: DynamicSchedule,
  today: string,
): CurriculumRow[] {
  const done = finishedSectionIds(logs);
  const currentId = dyn.currentSection?.id ?? null;
  const ordered = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return ordered.map((section) => {
    const minutesLogged = sectionEffortMinutes(logs, section.id);
    const targetDate = dyn.perSectionDue[section.id] ?? null;

    let status: SectionStatus;
    if (done.has(section.id)) status = 'done';
    else if (section.id === currentId) status = 'in_progress';
    else if (targetDate && targetDate < today) status = 'overdue';
    else status = 'upcoming';

    return { section, status, minutesLogged, targetDate };
  });
}
```

- [ ] **Step 4: Update the curriculum component**

In `components/coach/curriculum.tsx`, lines 87–88, replace `r.targetFriday` with `r.targetDate`:
```tsx
                    {r.targetDate && (
                      <p className="mt-4 text-[0.7rem] uppercase tracking-wider text-faint">Target by {fmtDate(r.targetDate)}</p>
                    )}
```

- [ ] **Step 5: Run tests + type-check**

Run: `pnpm test tests/schedule.test.ts && pnpm exec tsc --noEmit`
Expected: tests PASS; tsc clean (no other `targetFriday` references remain — the pages don't read it directly).

- [ ] **Step 6: Commit**

```bash
git add lib/schedule.ts tests/schedule.test.ts components/coach/curriculum.tsx
git commit -m "refactor: buildCurriculumRows reads dynamic schedule (targetFriday → targetDate)"
```

---

## Task 4: Wire the coach view to the dynamic schedule

**Files:**
- Modify: `components/coach/this-week.tsx` (full rewrite)
- Modify: `app/r/[token]/page.tsx`

**Interfaces:**
- Consumes: `buildDynamicSchedule`, `DynamicSchedule` (Task 2); refactored `buildCurriculumRows` (Task 3).

- [ ] **Step 1: Rewrite `ThisWeek` to render the dynamic deadline + days-delta**

Replace `components/coach/this-week.tsx`:
```tsx
import type { LogEntry, DynamicSchedule } from '@/lib/schedule';
import { sectionEffortMinutes, phaseForWeek } from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { fmtDur, fmtDate } from '@/lib/format';

export function ThisWeek({ week, dyn, logs }: { week: number; dyn: DynamicSchedule; logs: LogEntry[] }) {
  const cur = dyn.currentSection;
  const phase = phaseForWeek(week);
  const curEffort = cur ? sectionEffortMinutes(logs, cur.id) : 0;
  const curBudget = cur ? Math.round(cur.videoMinutes * PLAN.multiplier) : 0;
  const d = dyn.daysDelta;
  const deltaLabel = d > 0 ? `${d} day${d === 1 ? '' : 's'} ahead of schedule`
    : d < 0 ? `${-d} day${d === -1 ? '' : 's'} behind schedule`
    : 'right on schedule';
  const deltaCls = d >= 0 ? 'text-accent' : 'text-warn';
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">This week · Week {week || '—'}</div>
        {phase && <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">Phase {phase.n}: {phase.name}</div>}
      </div>
      {cur ? (
        <div className="mt-3 space-y-1">
          <div className="text-ink">Current: <span className="font-medium">S{cur.id} {cur.title}</span></div>
          <div className="text-sm text-muted">{fmtDur(curEffort)} spent vs {fmtDur(curBudget)} budgeted for this section</div>
          <div className="text-sm text-muted">
            {dyn.isCurrentOverdue ? 'Overdue — aim to finish by ' : 'Target: finish by '}
            <span className="font-medium text-ink">{dyn.currentDueDate ? fmtDate(dyn.currentDueDate) : '—'}</span>
            {' · '}<span className={deltaCls}>{deltaLabel}</span>
          </div>
        </div>
      ) : <div className="mt-3 text-accent">All core sections complete 🎉</div>}
    </div>
  );
}
```

- [ ] **Step 2: Wire the coach page**

In `app/r/[token]/page.tsx`:
- Add `buildDynamicSchedule` to the `@/lib/schedule` import; remove `buildMilestones`.
- Delete `const milestones = buildMilestones(sections, PLAN);` and `const thisWeekMilestone = milestones.find((m) => m.week === week) ?? null;`.
- Add `const dyn = buildDynamicSchedule(sections, logs, PLAN, today);`.
- Change `const rows = buildCurriculumRows(sections, logs, milestones, today);` → `const rows = buildCurriculumRows(sections, logs, dyn, today);`.
- Change the ThisWeek render to: `<ThisWeek week={week} dyn={dyn} logs={logs} />`.

- [ ] **Step 3: Build (hook) + type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean. (`buildMilestones` no longer imported in the coach page; no `milestone`/`sections` props passed to ThisWeek.)

- [ ] **Step 4: Commit**

```bash
git add components/coach/this-week.tsx app/r/'[token]'/page.tsx
git commit -m "feat: coach view uses dynamic schedule (roadmap dates + this-week)"
```

---

## Task 5: Wire the student view (next checkpoint + projected finish + buffer)

**Files:**
- Modify: `components/student/journey-stats.tsx` (full rewrite)
- Modify: `app/m/[token]/page.tsx`

**Interfaces:**
- Consumes: `buildDynamicSchedule`, `DynamicSchedule`; refactored `buildCurriculumRows`.

- [ ] **Step 1: Rewrite `JourneyStats`**

Replace `components/student/journey-stats.tsx`:
```tsx
import type { Phase, DynamicSchedule } from '@/lib/schedule';
import { fmtDur, fmtDate } from '@/lib/format';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 text-center">
      <div className="font-serif text-2xl font-semibold text-ink">{value}</div>
      <div className="text-[0.7rem] uppercase tracking-wider text-faint">{label}</div>
    </div>
  );
}

export function JourneyStats({
  sectionsDone, totalSections, effortMinutes, phase, dyn, daysToDeadline,
}: {
  sectionsDone: number; totalSections: number; effortMinutes: number;
  phase: Phase | null; dyn: DynamicSchedule; daysToDeadline: number;
}) {
  const d = dyn.daysDelta;
  const buffer = d > 0
    ? { text: `🎉 You're ${d} day${d === 1 ? '' : 's'} ahead — keep banking time!`, cls: 'text-accent' }
    : d < 0
      ? { text: `You're ${-d} day${d === -1 ? '' : 's'} behind — one good session brings it back. 💚`, cls: 'text-warn' }
      : { text: 'Right on schedule. 💚', cls: 'text-muted' };
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Your journey</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Tile label="sections" value={`${sectionsDone}/${totalSections}`} />
        <Tile label="invested" value={fmtDur(effortMinutes)} />
        <Tile label="days left" value={String(Math.max(0, daysToDeadline))} />
      </div>
      {phase && <p className="mt-3 text-sm text-muted">You&apos;re in <span className="font-medium text-ink">Phase {phase.n}: {phase.name}</span>.</p>}
      {dyn.currentSection ? (
        <p className="mt-1 text-sm text-muted">
          {dyn.isCurrentOverdue ? 'Catch up: finish ' : 'Next checkpoint: finish '}
          <span className="font-medium text-ink">{dyn.currentSection.title}</span>
          {dyn.currentDueDate ? <> by <span className="font-medium text-ink">{fmtDate(dyn.currentDueDate)}</span></> : null}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-accent">Course complete — you did it! 🎉</p>
      )}
      <p className="mt-1 text-sm text-muted">On this pace you&apos;ll finish by <span className="font-medium text-ink">{fmtDate(dyn.projectedFinishDate)}</span>.</p>
      <p className={`mt-2 text-sm font-medium ${buffer.cls}`}>{buffer.text}</p>
    </div>
  );
}
```

- [ ] **Step 2: Wire the student page**

In `app/m/[token]/page.tsx`:
- Add `buildDynamicSchedule` to the `@/lib/schedule` import; remove `buildMilestones`.
- Delete `const milestones = buildMilestones(sections, PLAN);` and `const milestone = milestones.find((m) => m.week === week) ?? null;`.
- Add `const dyn = buildDynamicSchedule(sections, logs, PLAN, today);`.
- Change `const rows = buildCurriculumRows(sections, logs, milestones, today);` → `const rows = buildCurriculumRows(sections, logs, dyn, today);`.
- In the `<JourneyStats .../>` render, replace `milestone={milestone}` with `dyn={dyn}` (keep the other props).

- [ ] **Step 3: Build + type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean (`buildMilestones`/`milestone` no longer referenced; `JourneyStats` gets `dyn`).

- [ ] **Step 4: Commit**

```bash
git add components/student/journey-stats.tsx app/m/'[token]'/page.tsx
git commit -m "feat: student view dynamic checkpoint, projected finish + buffer badge"
```

---

## Task 6: Full verification + push

- [ ] **Step 1: Full suite + lint + build**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: all tests pass, lint clean, build succeeds.

- [ ] **Step 2: Live verify in Chrome** (dev server on `:3003`)

Coach `/r/<token>` and student `/m/<token>`:
- Student "Your journey": "Next checkpoint: finish JavaScript Fundamentals – Part 2 by **Fri 3 Jul**" (not "Section 1 by 26 Jun"), a projected-finish date, and a green "🎉 You're N days ahead" line.
- Coach roadmap + "This week": current section's dynamic date + "N days ahead/behind".
- Mark a section finished via Mansi's check-in → after reload, the next checkpoint advances to the new current section with a recomputed date. (Note: writes a real log.)
- Both light + dark themes clean.

- [ ] **Step 3: Push for merge**

```bash
git push -u origin feat/dynamic-milestones
```
Hold the PR/merge for Rahul (he merges to `main` → Vercel production deploy).

---

## Self-Review

**Spec coverage:**
- `addStudyDays` (study-days counting) → Task 1. ✓
- `buildDynamicSchedule` (anchor, per-section dates, projection, daysDelta, honest-when-behind) → Task 2. ✓
- `buildCurriculumRows` refactor (`targetDate`, reads `dyn`) → Task 3. ✓
- Coach roadmap + ThisWeek dynamic → Task 4. ✓
- Student next-checkpoint + projected finish + buffer badge → Task 5. ✓
- Keep `buildMilestones` + tests; stop importing it in pages → Tasks 4-5. ✓
- Edge cases (not-started, idle/overdue, all-done, bonus/skip) → Task 2 tests. ✓
- Preserve uncommitted typing-effect → Task 0. ✓
- Verification (suite + live) → Task 6. ✓

**Placeholder scan:** logic tasks (1-3) carry full TDD code; UI tasks (4-5) carry full component code + exact page edits; no vague steps.

**Type consistency:** `DynamicSchedule` shape identical across Tasks 2→3→4→5; `buildCurriculumRows(sections, logs, dyn, today)` call sites (coach + student pages) match the Task 3 signature; `CurriculumRow.targetDate` used in `curriculum.tsx` (Task 3) matches the type; `ThisWeek({week, dyn, logs})` and `JourneyStats({…, dyn, …})` prop shapes match their page call sites.
