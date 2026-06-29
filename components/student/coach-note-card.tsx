import type { Message } from '@/lib/db/queries';
import { TypingText } from './typing-text';

export function CoachNoteCard({ note, coachName }: { note: Message | null; coachName: string }) {
  if (!note) return null;
  return (
    <div className="rounded-2xl bg-accent-soft p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">💌 A note from {coachName}</div>
      <TypingText text={note.body} className="mt-2 font-serif text-lg leading-relaxed text-ink-2" />
    </div>
  );
}
