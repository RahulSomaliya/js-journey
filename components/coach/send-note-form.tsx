'use client';
import { useRef, useState, useTransition } from 'react';
import { sendCoachNoteAction } from '@/lib/actions/message';

export function SendNoteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      ref={formRef}
      action={(fd) => start(async () => {
        const r = await sendCoachNoteAction(fd);
        if (r.ok) { formRef.current?.reset(); setSent(true); setTimeout(() => setSent(false), 3000); }
      })}
      className="rounded-2xl border border-hair bg-surface p-5"
    >
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Send Mansi a note</div>
      <textarea name="body" rows={2} placeholder="A line of encouragement…" className="mt-2 w-full resize-none rounded-lg border border-hair bg-surface-2 p-3 text-ink placeholder:text-faint" />
      <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50">{sent ? 'Sent 💚' : pending ? 'Sending…' : 'Send'}</button>
    </form>
  );
}
