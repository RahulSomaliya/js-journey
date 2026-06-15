import type { Message } from '@/lib/db/queries';

export function CoachNoteCard({ note }: { note: Message | null }) {
  if (!note) return null;
  return (
    <div className="rounded-2xl border-l-[3px] border-accent bg-accent-soft p-4">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">A note from your coach</div>
      <p className="mt-1 text-ink-2">{note.body}</p>
    </div>
  );
}
