import {
  buildMilestones, contentMinutesPerWeek, coreSections, currentWeek, finishedSectionIds, planBreakFor, planTimeline,
  type LogEntry, type ScheduleConfig, type Section, type WeeklyMilestone,
} from '@/lib/schedule';
import type { JourneyStatus } from '@/lib/player';
import { STUDY_WEEKDAYS } from '@/lib/date';

// GET /api/player/status — and the plan status both web pages print (lib/overview.ts →
// lib/journey-view.ts weekView: /m "This week", /r header), so all three read the same:
// - pace + daysDelta = planPace: ONE model, the weekly goals ("Ahead by 2 days" / "On track" /
//              "Behind by 3 days" in the pill, the same in the Due stat) — see planPace for the trap
// - goal     = this plan week's goal (planGoal) — "Finish §12 … by Fri 23 Oct"
// - sectionDue = every counted section's plan-week Friday (sectionDueDates)
// - planBreak = planBreakFor: the break in progress, else the next within 14 days
//              (all three show the same break; every number above already skips it)
// - skippedSections = sections the plan skips (kind 'skip': React §04)
// - studyWeekdays + planBreaks = the plan calendar (Mon–Fri, EVERY break) the streak walks — the player's
//              (web/src/lib/stats.ts) and lib/stats.ts here, from this one status, so both read one number
// Pure: the route handler only loads the rows and the clock.
export function computeJourneyStatus(args: {
  today: string;
  sections: Section[];
  logs: LogEntry[];
  config: ScheduleConfig;
  coachNote: { body: string; createdAt: string } | null;
}): JourneyStatus {
  const { today, sections, logs, config, coachNote } = args;
  const { pace, daysDelta } = planPace({ today, sections, logs, config });
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
    goal: planGoal({ week, sections, logs, milestones }),
    coachNote: coachNote ? { body: coachNote.body, createdAt: coachNote.createdAt } : null,
    planBreak: planBreakFor(today, config.breaks),
    sectionDue,
    // sortOrder = the course's own section number (React: folder NN) — what the player knows
    skippedSections: sections.filter((s) => s.kind === 'skip').map((s) => s.sortOrder).sort((a, b) => a - b),
    studyWeekdays: [...STUDY_WEEKDAYS],
    planBreaks: config.breaks.map((b) => ({ label: b.label, start: b.start, end: b.end })),
  };
}

// The pace pill, in ONE model: the weekly goals — the same ones "This week" and the coach's plan list show.
// TRAP (2026-10-01): pace once came from computePace (content vs a DAILY-prorated plan, ±half week) and
// the number from buildDynamicSchedule (projected finish vs target). They disagreed (a bare "Behind" while
// the plan list said week 3 was on schedule), and BOTH swing for a student who is exactly on plan:
// sections finish in chunks, so prorated reads "behind" every Wed/Thu; the projection reads "+3" on day 1
// (the plan's slack in its last week) and "−5" on Thu 24 Dec. tests/status.test.ts walks an on-plan
// student through every study day — keep pace and daysDelta from this one function.
//   behind = a goal whose Friday has PASSED is unmet; by the plan-pace study days of work still missing
//            from it (at least 1: a missed goal is never "Behind by 0 days")
//   ahead  = finished past THIS week's goal by ≥ half a study day of work; by that many study days
//   else on track (anywhere between last Friday's goal and this Friday's — the week's own work)
// "Finished" = every counted section up to that point (sectionsFinishedBy via finishedSectionIds), the
// same rule as planGoal / the plan list: a section done out of order does not count until the gap closes.
export function planPace(args: { today: string; sections: Section[]; logs: LogEntry[]; config: ScheduleConfig }): Pick<JourneyStatus, 'pace' | 'daysDelta'> {
  const { today, sections, logs, config } = args;
  const core = coreSections(sections);
  const done = finishedSectionIds(logs);
  const perStudyDay = contentMinutesPerWeek(config) / config.studyDaysPerWeek;
  // content minutes of every counted section up to and including `sectionId` (in course order)
  const upTo = (sectionId: number): number => {
    const order = core.find((c) => c.id === sectionId)?.sortOrder ?? 0;
    return core.filter((c) => c.sortOrder <= order).reduce((sum, c) => sum + c.videoMinutes, 0);
  };
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

// The goal "This week" shows: the current plan week's milestone ("finish §12 by Fri 23 Oct").
// Once she has finished everything it asks for (she is ahead), the next unmet week's goal
// takes its place, so the goal is never one she already met; null when the course is done.
// Its due date is sectionDue of the same section — the player shows both on one screen,
// so the two must never disagree (tests/status.test.ts pins it).
// Behind? Still this week's goal — the pace pill carries the "behind", not an old goal.
export function planGoal(args: {
  week: number; sections: Section[]; logs: LogEntry[]; milestones: WeeklyMilestone[];
}): JourneyStatus['goal'] {
  const { week, sections, logs, milestones } = args;
  const done = finishedSectionIds(logs); // sectionsFinishedBy: mid-session finishes count
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
