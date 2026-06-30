'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createLogAction } from '@/lib/actions/log';
import { fmtDur } from '@/lib/format';
import type { Section } from '@/lib/schedule';
import { SectionSelect } from './section-select';

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

export function CheckInForm({ sections, currentSectionId, finishedIds }: { sections: Section[]; currentSectionId: number | null; finishedIds: number[] }) {
  const [minutes, setMinutes] = useState(120); // 2h default
  const [sectionOverride, setSectionOverride] = useState<number | null>(null);
  const sectionId = sectionOverride ?? currentSectionId;
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [done, setDone] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');
  const [finishedTitle, setFinishedTitle] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // auto-grow the note field with its content (and shrink back when it clears)
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [note]);

  function submit() {
    const fd = new FormData();
    fd.set('minutes', String(minutes));
    if (sectionId != null) fd.set('sectionId', String(sectionId));
    if (note.trim()) fd.set('note', note.trim());
    if (mood) fd.set('mood', mood);
    if (finished) fd.set('finishedSection', 'on');
    const celebrate = finished ? (sections.find((s) => s.id === sectionId)?.title ?? null) : null;
    start(async () => {
      const res = await createLogAction(fd);
      if (res.ok) {
        setFinishedTitle(celebrate);
        setDoneMsg(encouragement(fmtDur(minutes)));
        setDone(true);
        setSectionOverride(null); setNote(''); setMood(null); setFinished(false);
        setTimeout(() => { setDone(false); setFinishedTitle(null); }, celebrate ? 6500 : 4000);
      }
    });
  }

  if (done) {
    const big = finishedTitle != null;
    const pieces = big ? 28 : 14;
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-accent-soft text-center reveal ${big ? 'p-10' : 'p-8'}`}>
        <div className="confetti pointer-events-none absolute inset-x-0 top-0">
          {Array.from({ length: pieces }).map((_, i) => (
            <span key={i} style={{ left: `${(i / pieces) * 100}%`, background: i % 2 ? 'var(--accent)' : 'var(--amber)', animationDelay: `${i * 35}ms` }} />
          ))}
        </div>
        {big ? (
          <>
            <div className="text-5xl">🎉</div>
            <div className="mt-3 font-serif text-2xl font-semibold text-accent-deep">Section complete!</div>
            <div className="mt-1 text-lg font-medium text-ink">You finished {finishedTitle}</div>
            <p className="mt-2 text-sm text-muted">That’s a whole chapter of your journey done. So proud of you. 💚</p>
          </>
        ) : (
          <div className="text-lg font-medium text-accent-deep">{doneMsg}</div>
        )}
      </div>
    );
  }

  return (
    <form action={submit} className="rounded-2xl border border-hair bg-surface p-6 shadow">
      <h2 className="font-serif text-xl font-semibold text-ink">Your daily check-in</h2>
      <p className="mt-0.5 text-sm text-faint">Takes about fifteen seconds. 💚</p>

      <label className="mt-5 block text-sm font-semibold text-ink-2">What did you work on?</label>
      <div className="mt-2">
        <SectionSelect
          sections={sections.filter((s) => s.kind === 'core')}
          value={sectionId}
          onChange={setSectionOverride}
          finishedIds={finishedIds}
        />
      </div>

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

      <textarea
        ref={noteRef}
        rows={1}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="A note about today — write as much as you like (optional)"
        className="mt-5 block w-full resize-none overflow-hidden rounded-lg border border-hair bg-surface-2 p-3 text-ink leading-relaxed placeholder:text-faint focus:border-accent focus:outline-none"
      />

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
