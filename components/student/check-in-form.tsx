'use client';
import { useState, useTransition } from 'react';
import { createLogAction } from '@/lib/actions/log';
import { fmtDur } from '@/lib/format';
import type { Section } from '@/lib/schedule';

const MOODS = [
  { e: '🚀', l: 'Flying' },
  { e: '😊', l: 'Good' },
  { e: '🙂', l: 'Okay' },
  { e: '😮‍💨', l: 'Tough' },
];

// varied, hours-aware confirmation lines (spec §6 asks for a "varied" encouraging line)
function encouragement(label: string): string {
  const lines = [
    `🎉 ${label} logged — that's real progress today.`,
    `🔥 ${label} in the books. Future-you says thanks.`,
    `✨ Nice — ${label} closer. Consistency is the whole game.`,
    `💪 ${label} done. Showing up is most of the battle.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

export function CheckInForm({ sections, currentSectionId }: { sections: Section[]; currentSectionId: number | null }) {
  const [minutes, setMinutes] = useState(120); // 2h default
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
        setDoneMsg(encouragement(fmtDur(minutes)));
        setDone(true);
        setSectionOverride(null); setNote(''); setMood(null); setFinished(false);
        setTimeout(() => setDone(false), 4000);
      }
    });
  }

  if (done) return (
    <div className="relative overflow-hidden rounded-2xl bg-accent-soft p-8 text-center text-lg font-medium text-accent-deep reveal">
      <div className="confetti pointer-events-none absolute inset-x-0 top-0">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ left: `${(i / 14) * 100}%`, background: i % 2 ? 'var(--accent)' : 'var(--amber)', animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
      {doneMsg}
    </div>
  );

  return (
    <form action={submit} className="rounded-2xl border border-hair bg-surface p-6 shadow">
      <h2 className="font-serif text-xl font-semibold text-ink">Your daily check-in</h2>
      <p className="mt-0.5 text-sm text-faint">Takes about fifteen seconds. 💚</p>

      <label className="mt-5 block text-sm font-semibold text-ink-2">What did you work on?</label>
      <select value={sectionId ?? ''} onChange={(e) => setSectionOverride(Number(e.target.value))}
        className="mt-2 w-full rounded-lg border border-hair bg-surface-2 p-3 text-ink">
        {sections.filter((s) => s.kind === 'core').map((s) => (
          <option key={s.id} value={s.id}>{s.id}. {s.title}</option>
        ))}
      </select>

      <label className="mt-5 block text-sm font-semibold text-ink-2">For how long?</label>
      <div className="mt-2 flex items-center justify-center gap-5">
        <button type="button" aria-label="Less time" onClick={() => setMinutes((m) => Math.max(15, m - 15))}
          className="grid h-12 w-12 place-items-center rounded-full border border-hair bg-surface-2 text-2xl text-ink transition hover:border-accent">−</button>
        <div className="min-w-28 text-center font-serif text-3xl font-semibold text-ink">{fmtDur(minutes)}</div>
        <button type="button" aria-label="More time" onClick={() => setMinutes((m) => Math.min(360, m + 15))}
          className="grid h-12 w-12 place-items-center rounded-full border border-hair bg-surface-2 text-2xl text-ink transition hover:border-accent">+</button>
      </div>

      <label className="mt-5 block text-sm font-semibold text-ink-2">How did it feel?</label>
      <div className="mt-2 flex items-stretch gap-2">
        {MOODS.map((m) => (
          <button type="button" key={m.e} onClick={() => setMood(m.e === mood ? null : m.e)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-2 transition ${mood === m.e ? 'border-accent bg-accent-soft' : 'border-hair bg-surface-2 hover:border-hair-strong'}`}>
            <span className="text-xl">{m.e}</span>
            <span className="text-[0.65rem] text-faint">{m.l}</span>
          </button>
        ))}
      </div>

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line about today (optional)"
        className="mt-5 w-full rounded-lg border border-hair bg-surface-2 p-3 text-ink placeholder:text-faint" />

      <label className="mt-4 flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={finished} onChange={(e) => setFinished(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        I finished this section ✓
      </label>

      <button type="submit" disabled={pending}
        className="mt-6 w-full rounded-xl bg-accent py-3.5 text-base font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60">
        {pending ? 'Saving…' : 'Log today'}
      </button>
    </form>
  );
}
