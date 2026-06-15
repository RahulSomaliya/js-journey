import type { Message } from '@/lib/db/queries';
import { resolveStuckAction } from '@/lib/actions/message';

export function StuckList({ items }: { items: Message[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border-l-[3px] border-warn bg-warn-soft p-5">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-warn">Needs your help</div>
      <ul className="mt-3 space-y-3">
        {items.map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-3">
            <p className="text-ink-2">{m.body}</p>
            <form action={resolveStuckAction}>
              <input type="hidden" name="id" value={m.id} />
              <button className="whitespace-nowrap rounded-lg border border-hair-strong px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent">resolve</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
