import type { LogEntry, Section } from '@/lib/schedule';

export function LogsFeed({ logs, sections }: { logs: LogEntry[]; sections: Section[] }) {
  const title = (id: number | null) => sections.find((s) => s.id === id)?.title ?? 'Review';
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Recent logs</div>
      <ul className="mt-3 divide-y divide-hair">
        {logs.slice(0, 12).map((l) => (
          <li key={l.id} className="flex items-start justify-between gap-3 py-2.5">
            <div>
              <div className="text-sm font-medium text-ink">{title(l.sectionId)} {l.finishedSection && <span className="text-accent">✓</span>}</div>
              {l.note && <div className="text-sm text-muted">{l.note}</div>}
            </div>
            <div className="whitespace-nowrap text-right text-sm text-faint">{l.mood} {(l.minutes / 60).toFixed(1)}h<br />{l.studyDate.slice(5)}</div>
          </li>
        ))}
        {logs.length === 0 && <li className="py-3 text-sm text-faint">No logs yet.</li>}
      </ul>
    </div>
  );
}
