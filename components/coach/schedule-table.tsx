import type { WeeklyMilestone, LogEntry, Section } from '@/lib/schedule';
import { finishedSectionIds, currentSection, phaseForWeek } from '@/lib/schedule';

export function ScheduleTable({ milestones, logs, sections, today }: { milestones: WeeklyMilestone[]; logs: LogEntry[]; sections: Section[]; today: string }) {
  const done = finishedSectionIds(logs);
  const curId = currentSection(sections, logs)?.id ?? null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-hair bg-surface shadow">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-2 text-left text-[0.7rem] uppercase tracking-wider text-faint">
            <th className="p-3">Phase</th><th className="p-3">Wk</th><th className="p-3">By Friday</th><th className="p-3">Through</th><th className="p-3">State</th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((m) => {
            const isDone = done.has(m.throughSectionId);
            const isCurrent = !isDone && m.throughSectionId === curId; // in-progress section (0-credit but active)
            const overdue = m.fridayDate < today && !isDone && !isCurrent;
            const phase = phaseForWeek(m.week);
            return (
              <tr key={m.week} className="border-t border-hair">
                <td className="p-3 text-faint">{phase ? `P${phase.n}` : ''}</td>
                <td className="p-3 text-faint">{m.week}</td>
                <td className="p-3 text-ink-2">{m.fridayDate}</td>
                <td className="p-3 text-ink">S{m.throughSectionId}: {m.throughSectionTitle}</td>
                <td className="p-3">{isDone ? <span className="text-accent">done ✓</span> : isCurrent ? <span className="text-accent-deep">in progress</span> : overdue ? <span className="text-warn">overdue</span> : <span className="text-faint">upcoming</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
