'use client';
import { useEffect, useRef } from 'react';
import { markCoachMessagesReadAction } from '@/lib/actions/message';

export interface FromRahulMessage {
  id: string;
  body: string;
  /** "Today 19:40" (IST, formatted on the server) */
  when: string;
  /** "On yesterday’s update" + her note's snippet; null for a standalone note */
  context: { lead: string; quote: string | null } | null;
}

// The top of her page: everything Rahul wrote that she has not seen, newest first (the player's
// "From Rahul" block). Shown = seen: it marks them read once on screen — the action revalidates only
// /r, so this view keeps its "new" marks while she reads; the next visit no longer shows the block.
// Nothing unread → no block at all.
export function FromRahul({ items }: { items: FromRahulMessage[] }) {
  const marked = useRef(new Set<string>());
  useEffect(() => {
    const ids = items.map((i) => i.id).filter((id) => !marked.current.has(id));
    if (ids.length === 0) return;
    for (const id of ids) marked.current.add(id);
    markCoachMessagesReadAction(ids)
      .then((r) => {
        if (!r.ok) console.error('[from-rahul] could not mark read', { ids, error: r.error });
      })
      .catch((e: unknown) => console.error('[from-rahul] could not mark read', { ids, e }));
  }, [items]);

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="from-rahul" className="animate-arrive">
      <div className="rounded-lg border border-line bg-surface p-5 shadow-e1 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="from-rahul" className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-ink">From Rahul</h2>
          {items.length > 1 && <p className="text-sm tabular-nums text-ink-muted">{items.length} new</p>}
        </div>
        <ul className="mt-4 space-y-6">
          {items.map((m) => (
            <li key={m.id}>
              {m.context && (
                <p className="mb-2 text-sm text-ink-muted">
                  {m.context.lead}
                  {m.context.quote && (
                    <>
                      : <q className="italic">{m.context.quote}</q>
                    </>
                  )}
                </p>
              )}
              <p className="max-w-[68ch] whitespace-pre-line text-lg leading-7 text-ink">{m.body}</p>
              <p className="mt-1 text-sm text-ink-subtle">{m.when}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
