'use client';
import { useState, useTransition } from 'react';
import { sendStuckAction } from '@/lib/actions/message';

export function StuckButton({ sectionId }: { sectionId: number | null }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (sent) return <p className="text-sm text-accent">Sent to your coach — help is on the way. 💚</p>;
  if (!open) return <button onClick={() => setOpen(true)} className="text-sm text-faint underline underline-offset-2 hover:text-warn">I&apos;m stuck on something…</button>;
  return (
    <form
      action={(fd) => {
        if (sectionId != null) fd.set('sectionId', String(sectionId));
        start(async () => { const r = await sendStuckAction(fd); if (r.ok) setSent(true); });
      }}
      className="rounded-xl border border-hair bg-surface-2 p-3"
    >
      <textarea name="body" rows={2} placeholder="What's tripping you up?" className="w-full resize-none bg-transparent text-ink placeholder:text-faint" />
      <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white">{pending ? 'Sending…' : 'Send'}</button>
    </form>
  );
}
