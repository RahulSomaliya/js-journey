'use client';
import { useState, useTransition } from 'react';
import { createLogAction } from '@/lib/actions/log';
import type { Section } from '@/lib/schedule';

const MOODS = ['🚀', '😊', '😐', '😮‍💨'];

// varied, hours-aware confirmation lines (spec §6 asks for a "varied" encouraging line)
function encouragement(hours: string): string {
  const lines = [
    `🎉 ${hours}h logged — that's real progress today.`,
    `🔥 ${hours}h in the books. Future-you says thanks.`,
    `✨ Nice — ${hours}h closer. Consistency is the whole game.`,
    `💪 ${hours}h done. Showing up is most of the battle.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

export function CheckInForm({ sections, currentSectionId }: { sections: Section[]; currentSectionId: number | null }) {
  const [minutes, setMinutes] = useState(150); // 2.5h default
  // section is an OVERRIDE that falls back to the live current-section prop, so the dropdown
  // auto-follows after a log advances the focus (instead of going stale).
  const [sectionOverride, setSectionOverride] = useState<number | null>(null);
  const sectionId = sectionOverride ?? currentSectionId;
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [done, setDone] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');
  const [pending, start] = useTransition();

  function submit() {
    const fd = new FormData();
    fd.set('minutes', String(minutes));
    if (sectionId != null) fd.set('sectionId', String(sectionId));
    if (note.trim()) fd.set('note', note.trim());
    if (mood) fd.set('mood', mood);
    if (finished) fd.set('finishedSection', 'on');
    start(async () => {
      const res = await createLogAction(fd);
      if (res.ok) {
        setDoneMsg(encouragement((minutes / 60).toFixed(1)));
        setDone(true);
        setSectionOverride(null); setNote(''); setMood(null); setFinished(false);
        setTimeout(() => setDone(false), 4000);
      }
    });
  }

  if (done) return <div className="rounded-2xl bg-accent-soft p-6 text-center text-accent-deep reveal">{doneMsg}</div>;

  return (
    <form action={submit} className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <label className="block text-sm font-semibold text-ink-2">Today I worked on</label>
      <select value={sectionId ?? ''} onChange={(e) => setSectionOverride(Number(e.target.value))}
        className="mt-2 w-full rounded-lg border border-hair bg-surface-2 p-3 text-ink">
        {sections.filter((s) => s.kind === 'core').map((s) => (
          <option key={s.id} value={s.id}>{s.id}. {s.title}</option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-semibold text-ink-2">For how long?</label>
      <div className="mt-2 flex items-center justify-center gap-4">
        <button type="button" aria-label="Less time" onClick={() => setMinutes((m) => Math.max(15, m - 15))}
          className="grid h-11 w-11 place-items-center rounded-full border border-hair bg-surface-2 text-2xl text-ink">−</button>
        <div className="min-w-24 text-center font-serif text-3xl font-semibold text-ink">{(minutes / 60).toFixed(2).replace(/\.?0+$/, '')}h</div>
        <button type="button" aria-label="More time" onClick={() => setMinutes((m) => Math.min(360, m + 15))}
          className="grid h-11 w-11 place-items-center rounded-full border border-hair bg-surface-2 text-2xl text-ink">+</button>
      </div>

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line about today (optional)"
        className="mt-4 w-full rounded-lg border border-hair bg-surface-2 p-3 text-ink placeholder:text-faint" />

      <div className="mt-4 flex items-center gap-2">
        {MOODS.map((m) => (
          <button type="button" key={m} onClick={() => setMood(m === mood ? null : m)}
            className={`grid h-10 w-10 place-items-center rounded-full border text-lg transition ${mood === m ? 'border-accent bg-accent-soft' : 'border-hair bg-surface-2'}`}>{m}</button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={finished} onChange={(e) => setFinished(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        I finished this section ✓
      </label>

      <button type="submit" disabled={pending}
        className="mt-5 w-full rounded-xl bg-accent py-3 font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60">
        {pending ? 'Saving…' : 'Log today'}
      </button>
    </form>
  );
}
