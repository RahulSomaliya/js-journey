import {
  buildMilestones, contentMinutesPerWeek, coreContentMinutes, coreSections, currentWeek, doneSectionIds, planBreakFor, planTimeline,
  type LogEntry, type ScheduleConfig, type Section, type WeeklyMilestone,
} from '@/lib/schedule';
import type { JourneyStatus, ProgressSnapshot, Projection } from '@/lib/player';
import { STUDY_WEEKDAYS, addDays, addStudyDays, isStudyDay, studyDaysBetween } from '@/lib/date';
import { outlineFor } from '@/lib/outline';
import { STREAK_MIN_SECONDS } from '@/lib/stats';

// GET /api/player/status — and the plan status both web pages print (lib/overview.ts →
// lib/journey-view.ts weekView: /m "This week", /r header), so all three read the same:
// - pace + daysDelta = planPace: ONE model ("Ahead by 2 days" / "On track" / "Behind by 3 days" in the
//              pill, the same in the Due stat) — her lecture content vs the prorated plan; see planPace
// - goal     = this plan week's goal (planGoal) — "Finish 12 … by Fri 23 Oct"
// - sectionDue = every counted section's plan-week Friday (sectionDueDates)
// - planBreak = planBreakFor: the break in progress, else the next within 14 days
//              (all three show the same break; every number above already skips it)
// - skippedSections = sections the plan skips (kind 'skip': React 04)
// - studyWeekdays + planBreaks = the plan calendar (Mon–Fri, EVERY break) the streak walks — the player's
//              (web/src/lib/stats.ts) and lib/stats.ts here, from this one status, so both read one number
// - startDate + dailyGoalMinutes (v4) = where the 30-day average starts, and the "goal met" bar
// - projection (v4) = where her CURRENT pace lands (planProjection)
// "Finished" everywhere here = her latest snapshot's sectionsDone ∪ the logs (doneSectionIds) — never logs alone.
// Pure: the route handler only loads the rows (the snapshot in the SAME parallel read) and the clock.
export function computeJourneyStatus(args: {
  today: string;
  sections: Section[];
  logs: LogEntry[];
  config: ScheduleConfig;
  coachNote: { body: string; createdAt: string } | null;
  /** her latest progress snapshot (progress_snapshots), null before the player sent one. REQUIRED on purpose:
   *  a caller without it reads the old logs-only pace — "Behind by 3 days" for a student 2 days ahead. */
  snapshot: ProgressSnapshot | null;
}): JourneyStatus {
  const { today, sections, logs, config, coachNote, snapshot } = args;
  const { pace, daysDelta } = planPace({ today, sections, logs, config, snapshot });
  const plan = planTimeline(sections, config);
  const milestones = buildMilestones(sections, config);
  const week = Math.max(1, currentWeek(today, config)); // pre-start reads "week 1" (the pages add "Starts Mon 5 Oct")
  const sectionDue = sectionDueDates(sections, milestones);
  return {
    pace,
    daysDelta,
    week,
    totalWeeks: plan.weeks,
    targetDate: plan.target,
    deadline: plan.deadline,
    goal: planGoal({ week, sections, logs, milestones, sectionsDone: snapshot?.sectionsDone ?? null }),
    coachNote: coachNote ? { body: coachNote.body, createdAt: coachNote.createdAt } : null,
    planBreak: planBreakFor(today, config.breaks),
    sectionDue,
    // sortOrder = the course's own section number (React: folder NN) — what the player knows
    skippedSections: sections.filter((s) => s.kind === 'skip').map((s) => s.sortOrder).sort((a, b) => a - b),
    studyWeekdays: [...STUDY_WEEKDAYS],
    planBreaks: config.breaks.map((b) => ({ label: b.label, start: b.start, end: b.end })),
    startDate: config.startDate,
    dailyGoalMinutes: Math.round(config.dailyHours * 60),
    projection: planProjection({ today, sections, logs, config, snapshot, target: plan.target }),
  };
}

// The pace pill, in ONE model (pill, Due stat, player, coach email: pace and daysDelta come from here only).
// v4 (2026-10-12): her CONTENT vs the plan PRORATED to the start of today.
//   done      = lecture minutes of counted sections in her latest snapshot (countedContent)
//   expected  = planExpectedMinutes: last week's goal + this week's content × (its study days elapsed BEFORE
//               today ÷ its study days) — today is never held against her until it is over
//   daysDelta = (done − expected) ÷ the current week's content per study day, rounded; |delta| < 1 = on track
// TRAP (2026-10-12): "finished" once came only from session logs, counted only WHOLE sections, in order, and
// against whole weekly goals. Section 01 had one unticked article and was never in a log, so the loop credited
// nothing and Monday of week 2 — on 07, 06 done — read "Behind by 3 days" while she was 2 days ahead
// (tests/status.test.ts "today's case"). Prorating was rejected on 2026-10-01 because whole SECTIONS finish
// in chunks (prorated read "behind" every Wed/Thu); lecture content moves daily, so prorating is honest now.
// No snapshot yet (or ever, for the JS history) → logsPace, the old weekly-goals reading.
export interface PaceArgs { today: string; sections: Section[]; logs: LogEntry[]; config: ScheduleConfig; snapshot: ProgressSnapshot | null; }
export function planPace(args: PaceArgs): Pick<JourneyStatus, 'pace' | 'daysDelta'> {
  const vsPlan = contentVsPlan(args);
  return vsPlan ? paceOf(vsPlan(planExpectedMinutes(args.today, args.sections, args.config))) : logsPace(args);
}

/** With a snapshot: (goal content minutes) → study days her content is past (+) or short of (−) it, in the
 *  pill's own unit (the current week's content per study day) and rounding. planPace measures against the
 *  prorated plan; planRows (lib/journey-view.ts) against a past week's goal — a row says "Behind" only when
 *  her CONTENT is short of that week's goal, never for one unticked article in a section. null without one. */
export function contentVsPlan(args: PaceArgs): ((goalMinutes: number) => number) | null {
  const { today, sections, logs, config, snapshot } = args;
  if (!snapshot) return null;
  const { done } = countedContent(sections, logs, snapshot);
  const perDay = weekContentPerStudyDay(today, sections, config);
  return (goalMinutes) => roundDays((done - goalMinutes) / perDay);
}

const paceOf = (daysDelta: number): Pick<JourneyStatus, 'pace' | 'daysDelta'> =>
  ({ pace: daysDelta > 0 ? 'ahead' : daysDelta < 0 ? 'behind' : 'on-track', daysDelta });
// half away from zero (2.5 → 3, −2.5 → −3), and never −0 (JSON prints it as 0, but toEqual tells them apart)
const roundDays = (x: number): number => (x < 0 ? -Math.round(-x) : Math.round(x)) + 0;

// Before the player sent a snapshot: the weekly goals over whole sections from the logs (the 2026-10-01 model).
//   behind = a goal whose Friday has PASSED is unmet; by the plan-pace study days of work still missing
//            from it (at least 1: a missed goal is never "Behind by 0 days")
//   ahead  = finished past THIS week's goal by ≥ half a study day of work; by that many study days
//   else on track (anywhere between last Friday's goal and this Friday's — the week's own work)
// "Finished" = every counted section up to that point, the same rule as planGoal / the plan list: a section
// done out of order does not count until the gap closes.
function logsPace(args: { today: string; sections: Section[]; logs: LogEntry[]; config: ScheduleConfig }): Pick<JourneyStatus, 'pace' | 'daysDelta'> {
  const { today, sections, logs, config } = args;
  const core = coreSections(sections);
  const done = doneSectionIds(sections, logs, null);
  const perStudyDay = contentMinutesPerWeek(config) / config.studyDaysPerWeek;
  const upTo = (sectionId: number): number => contentThrough(core, sectionId);
  let finished = 0;
  for (const c of core) {
    if (!done.has(c.id)) break;
    finished += c.videoMinutes;
  }
  const milestones = buildMilestones(sections, config);
  const passed = milestones.filter((m) => m.dueDate < today); // a goal is missed from the day AFTER its Friday
  const owed = passed.length ? upTo(passed[passed.length - 1].throughSectionId) : 0;
  const thisWeek = milestones.find((m) => m.dueDate >= today);
  const goal = thisWeek ? upTo(thisWeek.throughSectionId) : owed;
  if (finished < owed) return { pace: 'behind', daysDelta: -Math.max(1, Math.round((owed - finished) / perStudyDay)) };
  const ahead = Math.round((finished - goal) / perStudyDay);
  return ahead >= 1 ? { pace: 'ahead', daysDelta: ahead } : { pace: 'on-track', daysDelta: 0 };
}

/** The plan's content minutes through `sectionId` (every counted section up to and including it) — a weekly
 *  goal's size. */
export function planContentThrough(sections: Section[], sectionId: number): number {
  return contentThrough(coreSections(sections), sectionId);
}
/** content minutes of every counted section up to and including `sectionId` (in course order) */
function contentThrough(core: Section[], sectionId: number): number {
  const order = core.find((c) => c.id === sectionId)?.sortOrder ?? 0;
  return core.filter((c) => c.sortOrder <= order).reduce((sum, c) => sum + c.videoMinutes, 0);
}

/** Her lecture content in the plan's COUNTED sections, in minutes (React 04, skipped, never counts), with the
 *  counted total in the same measure. Exact with the snapshot's doneLectures + the course outline: each ticked
 *  lecture's seconds, and a whole section once it is finished (doneSectionIds — a log can say so before the
 *  next snapshot arrives). An older player (no doneLectures) → videoSecondsDone minus the non-counted
 *  sections she finished; a PARTLY watched 04 cannot be told apart there and counts. */
export function countedContent(sections: Section[], logs: LogEntry[], snapshot: ProgressSnapshot): { done: number; total: number } {
  const counted = coreSections(sections);
  const outline = outlineFor(snapshot.course);
  if (snapshot.doneLectures && outline) {
    const finished = doneSectionIds(sections, logs, snapshot.sectionsDone);
    let done = 0;
    let total = 0;
    for (const c of counted) {
      const lectures = outline.sections.find((s) => s.number === c.sortOrder)?.lectures ?? [];
      const ticked = new Set(snapshot.doneLectures[String(c.sortOrder)] ?? []);
      for (const l of lectures) {
        total += l.seconds;
        if (finished.has(c.id) || ticked.has(l.number)) done += l.seconds;
      }
    }
    return { done: done / 60, total: total / 60 };
  }
  const countedNumbers = new Set(counted.map((c) => c.sortOrder));
  const notCounted = sections
    .filter((s) => !countedNumbers.has(s.sortOrder) && snapshot.sectionsDone.includes(s.sortOrder))
    .reduce((sum, s) => sum + s.videoMinutes, 0);
  return { done: Math.max(0, snapshot.videoSecondsDone / 60 - notCounted), total: coreContentMinutes(sections) };
}

// The plan as a curve over its study days: one span per weekly goal, from the previous goal's content to its
// own, over that week's study days. A "keep going" week (a section longer than a week: React 29 = 7.9 h, so
// week 9's goal repeats week 8's section) has no goal of its own: its days join the next week's span — the
// plan expects PART of 29 by Fri 18 Dec, not nothing (its plan row says "Keep going", never "Behind").
interface PlanSpan { fromDay: number; toDay: number; from: number; to: number; }
function planSpans(sections: Section[], config: ScheduleConfig): PlanSpan[] {
  const core = coreSections(sections);
  const spans: PlanSpan[] = [];
  let fromDay = 0;
  let from = 0;
  for (const m of buildMilestones(sections, config)) {
    const to = contentThrough(core, m.throughSectionId);
    if (to <= from) continue; // a "keep going" week
    const toDay = m.week * config.studyDaysPerWeek;
    spans.push({ fromDay, toDay, from, to });
    fromDay = toDay;
    from = to;
  }
  return spans;
}

/** The counted content minutes the plan expects by the START of `today`: study days elapsed BEFORE today
 *  (breaks skipped, so Diwali holds it still), along the plan curve. Monday morning of week 2 = exactly week
 *  1's goal; 0 before the start; the whole course after the last week. */
export function planExpectedMinutes(today: string, sections: Section[], config: ScheduleConfig): number {
  const spans = planSpans(sections, config);
  if (spans.length === 0) return 0;
  const t = studyDaysBetween(config.startDate, today, config.breaks); // 0 before the start
  const s = spans.find((x) => t <= x.toDay);
  if (!s) return spans[spans.length - 1].to;
  return s.from + ((s.to - s.from) * (t - s.fromDay)) / (s.toDay - s.fromDay);
}

/** The current plan week's content per study day — the unit daysDelta counts in (week 2 = 06–09: 427 min ÷ 5).
 *  Weekends and break days belong to the week just studied (currentWeek); before the start, week 1; past the
 *  last week, the last one. */
function weekContentPerStudyDay(today: string, sections: Section[], config: ScheduleConfig): number {
  const spans = planSpans(sections, config);
  const weeks = buildMilestones(sections, config).length;
  const day = Math.min(Math.max(1, currentWeek(today, config)), weeks) * config.studyDaysPerWeek;
  const s = spans.find((x) => x.fromDay < day && day <= x.toDay) ?? spans[spans.length - 1];
  return s ? (s.to - s.from) / (s.toDay - s.fromDay) : contentMinutesPerWeek(config) / config.studyDaysPerWeek;
}

// Where her CURRENT pace lands (spec-v4 "Projection"; words: lib/journey-view.ts projectionLine).
//   rate   = counted lecture minutes done ÷ plan study days elapsed from the start through today — today
//            only once it has ≥ 5 min of study (STREAK_MIN_SECONDS); weekend study adds to `done`, never to the days
//   finish = ⌈left ÷ rate⌉ study days on, breaks skipped; today is the first of them while she has not studied yet
// null: no snapshot, before one full study week has elapsed (PROJECTION_MIN_STUDY_DAYS — week 1 is the plan's
// lightest week, so an on-plan student read "4 weeks after your target" on day 2; review 2026-10-12), fewer
// than 2 elapsed study days with study (one day's sample is noise), or nothing left.
export const PROJECTION_MIN_STUDY_DAYS = 5;
export function planProjection(args: {
  today: string; sections: Section[]; logs: LogEntry[]; config: ScheduleConfig; snapshot: ProgressSnapshot | null; target: string;
}): Projection | null {
  const { today, sections, logs, config, snapshot, target } = args;
  if (!snapshot || today < config.startDate) return null;
  const studied = (d: string) => (snapshot.days[d] ?? 0) >= STREAK_MIN_SECONDS;
  const todayCounts = studied(today) && isStudyDay(today, config.breaks);
  const elapsed = studyDaysBetween(config.startDate, today, config.breaks) + (todayCounts ? 1 : 0);
  let daysWithStudy = todayCounts ? 1 : 0;
  for (let d = config.startDate; d < today; d = addDays(d, 1)) if (isStudyDay(d, config.breaks) && studied(d)) daysWithStudy++;
  const { done, total } = countedContent(sections, logs, snapshot);
  const left = total - done;
  if (elapsed < PROJECTION_MIN_STUDY_DAYS || daysWithStudy < 2 || done <= 0 || left <= 0) return null;
  const rate = done / elapsed;
  const studyDaysLeft = Math.ceil(left / rate);
  const finish = addStudyDays(studied(today) ? today : addDays(today, -1), studyDaysLeft, config.breaks);
  const vsTarget = finish <= target
    ? studyDaysBetween(finish, target, config.breaks)
    : -studyDaysBetween(target, finish, config.breaks);
  return { finish, studyDaysLeft, minutesPerStudyDay: Math.round(rate), vsTarget };
}

// Section number → the Friday of the plan week whose goal first covers it (the FIXED plan:
// the date never moves when she is ahead or behind — pace says that). Counted sections
// only; skipped/bonus sections have no due date. Diwali-aware through buildMilestones.
export function sectionDueDates(sections: Section[], milestones: WeeklyMilestone[]): Record<string, string> {
  const orderOf = new Map(sections.map((s) => [s.id, s.sortOrder]));
  const out: Record<string, string> = {};
  for (const s of coreSections(sections)) {
    const m = milestones.find((x) => (orderOf.get(x.throughSectionId) ?? 0) >= s.sortOrder);
    if (m) out[String(s.sortOrder)] = m.dueDate;
  }
  return out;
}

// The goal "This week" shows: the current plan week's milestone ("finish 12 by Fri 23 Oct").
// Once she has finished everything it asks for (she is ahead), the next unmet week's goal
// takes its place, so the goal is never one she already met; null when the course is done.
// "Finished" = doneSectionIds (logs ∪ the snapshot's sectionsDone): logs alone kept a met goal open.
// Its due date is sectionDue of the same section — the player shows both on one screen,
// so the two must never disagree (tests/status.test.ts pins it).
// Behind? Still this week's goal — the pace pill carries the "behind", not an old goal.
export function planGoal(args: {
  week: number; sections: Section[]; logs: LogEntry[]; milestones: WeeklyMilestone[]; sectionsDone: readonly number[] | null;
}): JourneyStatus['goal'] {
  const { week, sections, logs, milestones, sectionsDone } = args;
  const done = doneSectionIds(sections, logs, sectionsDone);
  const core = coreSections(sections);
  const byId = new Map(sections.map((s) => [s.id, s]));
  const met = (m: WeeklyMilestone): boolean => {
    const through = byId.get(m.throughSectionId)?.sortOrder ?? 0;
    return core.filter((s) => s.sortOrder <= through).every((s) => done.has(s.id));
  };
  const from = Math.min(week, milestones.length) - 1; // past the last week (grace): the last goal
  const goal = milestones.slice(Math.max(0, from)).find((m) => !met(m));
  const section = goal ? byId.get(goal.throughSectionId) : undefined;
  return goal && section ? { sectionNumber: section.sortOrder, title: section.title, due: goal.dueDate } : null;
}
