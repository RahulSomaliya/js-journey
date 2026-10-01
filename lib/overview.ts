import { TIME_ZONE } from '@/lib/config';
import { todayInTZ } from '@/lib/date';
import { computeJourneyStatus } from '@/lib/status';
import { computeStats, type JourneyStats } from '@/lib/stats';
import { buildDynamicSchedule, type LogEntry, type ScheduleConfig, type Section } from '@/lib/schedule';
import type { JourneyStatus, ProgressSnapshot } from '@/lib/player';

// Everything "where is she" both v2 pages show above the feed: the plan status (the same
// JourneyStatus the player gets) + the stats row she sees, from ONE set of inputs so the
// two can never be computed from different rows. Pure — lib/db/queries.ts loadOverview
// feeds it from the database, lib/fixtures.ts from fixtures.
export interface Overview {
  /** today's Asia/Kolkata date */
  today: string;
  status: JourneyStatus;
  stats: JourneyStats;
  /** the first unfinished counted section ("you're here"); null when the course is done */
  currentSection: Section | null;
  sections: Section[];
  logs: LogEntry[];
  config: ScheduleConfig;
}

export function buildOverview(args: {
  now: Date;
  sections: Section[];
  logs: LogEntry[];
  config: ScheduleConfig;
  coachNote: { body: string; createdAt: string } | null;
  snapshot: ProgressSnapshot | null;
}): Overview {
  const { now, sections, logs, config, coachNote, snapshot } = args;
  const today = todayInTZ(TIME_ZONE, now);
  const status = computeJourneyStatus({ today, sections, logs, config, coachNote });
  return {
    today,
    status,
    stats: computeStats({ now, snapshot, logs, sections, status, startDate: config.startDate }),
    currentSection: buildDynamicSchedule(sections, logs, config, today).currentSection,
    sections,
    logs,
    config,
  };
}

/** false before her first session (no update, no player snapshot yet): both pages then show ONE line
 *  ("Your numbers start with your first session") instead of a row of zeros and an empty chart. */
export function hasNumbers(o: Pick<Overview, 'logs' | 'stats'>): boolean {
  return o.logs.length > 0 || o.stats.source === 'snapshot';
}
