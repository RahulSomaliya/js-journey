import type { LogEntry, Section } from '@/lib/schedule';
import { fmtDur } from '@/lib/format';

export function LogsFeed({ logs, sections }: { logs: LogEntry[]; sections: Section[] }) {
  const title = (id: number | null) => sections.find((s) => s.id === id)?.title ?? 'Review';
  return (
    <div className="rounded-2xl border border-hair bg-surface p-6">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Recent logs</div>
      {logs.length === 0 ? (
        <p className="mt-3 text-sm text-faint">No logs yet.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-x-12 gap-y-3.5">
          {logs.slice(0, 12).map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-4 border-b border-hair pb-3.5">
              <div>
                <div className="text-sm font-medium text-ink">
                  {title(l.sectionId)} {l.finishedSection && <span className="text-accent">✓</span>}
                </div>
                {l.note && <div className="mt-0.5 text-sm text-muted">{l.note}</div>}
              </div>
              <div className="shrink-0 whitespace-nowrap text-right text-sm text-faint">
                {l.mood} {fmtDur(l.minutes)}
                <br />
                {l.studyDate.slice(5)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
