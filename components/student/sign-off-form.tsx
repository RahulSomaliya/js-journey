'use client';
import { useId, useState, useTransition } from 'react';
import { signOffAction } from '@/lib/actions/log';
import { canSignOff, MOOD_LABELS, PLAYER_MOODS } from '@/lib/player';
import { fmtDur, sectionTag } from '@/lib/format';
import { AutoTextarea } from '@/components/auto-textarea';
import { buttonClass, CheckIcon, ChevronDownIcon, ErrorText } from '@/components/ui';

export interface SignOffSection { id: number; number: number; title: string; }

const STEP = 15;
const MAX_MINUTES = 8 * 60;
// 0, never a guess: it started at 1h, so one tap on "Send to Rahul" recorded an hour she never studied
// (honest to him) and fed it into her stats. Send stays disabled until canSignOff (time or a note).
const DEFAULT_MINUTES = 0;

// The manual sign-off, for study away from the player (a book, her phone, a project): ONE update for
// Rahul, exactly like a player sign-off (signOffAction: emails him, can be flagged stuck). Same four
// moods as the player — the action refuses any other. Minutes 0 = a note-only update (needs a note).
export function SignOffForm({ sections, currentSectionId }: { sections: SignOffSection[]; currentSectionId: number | null }) {
  const ids = { section: useId(), note: useId(), finished: useId() };
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [sectionId, setSectionId] = useState<number | null>(currentSectionId);
  const [finished, setFinished] = useState(false);
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function edit<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setSent(false);
    };
  }

  const canSend = canSignOff(minutes, note);

  function submit() {
    if (pending) return;
    if (!canSend) {
      setError('Add a note to send an update without study time.');
      return;
    }
    const fd = new FormData();
    fd.set('minutes', String(minutes));
    if (sectionId !== null) fd.set('sectionId', String(sectionId));
    if (finished) fd.set('finishedSection', 'on');
    if (note.trim()) fd.set('note', note.trim());
    if (mood) fd.set('mood', mood);
    if (stuck) fd.set('stuck', 'on');
    setError(null);
    start(async () => {
      try {
        const r = await signOffAction(fd);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setMinutes(DEFAULT_MINUTES);
        setFinished(false);
        setNote('');
        setMood(null);
        setStuck(false);
        setSent(true);
      } catch (e) {
        console.error('[sign-off] failed', e);
        setError('Could not reach JS Journey — nothing was sent yet. Try again in a moment.');
      }
    });
  }

  return (
    <form
      className="rounded-lg border border-line bg-surface p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:gap-8">
        <fieldset>
          <legend className="text-sm font-medium text-ink">Time studied</legend>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" aria-label="15 minutes less" disabled={minutes === 0} onClick={() => edit(setMinutes)(Math.max(0, minutes - STEP))} className={buttonClass('secondary', 'md', 'w-10 px-0 text-lg')}>
              −
            </button>
            <output aria-live="polite" className="min-w-24 text-center text-lg font-semibold tabular-nums text-ink">
              {fmtDur(minutes)}
            </output>
            <button type="button" aria-label="15 minutes more" disabled={minutes >= MAX_MINUTES} onClick={() => edit(setMinutes)(Math.min(MAX_MINUTES, minutes + STEP))} className={buttonClass('secondary', 'md', 'w-10 px-0 text-lg')}>
              +
            </button>
          </div>
        </fieldset>
        <div className="min-w-0">
          <label htmlFor={ids.section} className="text-sm font-medium text-ink">Section</label>
          <div className="relative mt-2">
            <select
              id={ids.section}
              value={sectionId ?? ''}
              onChange={(e) => edit(setSectionId)(e.target.value ? Number(e.target.value) : null)}
              className="h-10 w-full appearance-none truncate rounded-md border border-line bg-canvas pr-9 pl-3 text-sm text-ink"
            >
              <option value="">No particular section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{sectionTag(s.number)} {s.title}</option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-3 right-3 size-4 text-ink-muted" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input id={ids.finished} type="checkbox" checked={finished} disabled={sectionId === null} onChange={(e) => edit(setFinished)(e.target.checked)} className="size-4 accent-accent" />
            <label htmlFor={ids.finished} className="text-sm text-ink">I finished this section</label>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor={ids.note} className="text-sm font-medium text-ink">Note for Rahul</label>
        <AutoTextarea id={ids.note} rows={3} value={note} onChange={(e) => edit(setNote)(e.target.value)} placeholder="What did you learn? Anything unclear?" className="mt-2" />
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-ink">How did it feel?</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PLAYER_MOODS.map((m) => {
            const on = mood === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => edit(setMood)(on ? null : m)}
                className={`flex flex-col items-center gap-1 rounded-md border py-2 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-canvas hover:bg-fill'}`}
              >
                <span className="text-xl leading-none" aria-hidden="true">{m}</span>
                <span className={`text-xs ${on ? 'font-medium text-accent-ink' : 'text-ink-muted'}`}>{MOOD_LABELS[m]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          aria-pressed={stuck}
          onClick={() => edit(setStuck)(!stuck)}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium ${stuck ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink-muted hover:bg-fill hover:text-ink'}`}
        >
          {stuck && <CheckIcon className="size-4" strokeWidth={2} />}
          I’m stuck
        </button>
        {/* secondary until there is something to send (like the coach's Reply): a disabled primary is a
            50 % salmon block that shouts with nothing to do */}
        <button type="submit" disabled={pending || !canSend} className={buttonClass(canSend ? 'primary' : 'secondary', 'md', 'w-full sm:w-auto sm:min-w-40')}>
          {pending ? 'Sending…' : 'Send to Rahul'}
        </button>
      </div>
      <p role="status" className="text-sm text-ink-muted">
        {sent && (
          <span className="mt-4 flex items-center gap-1.5">
            <CheckIcon className="size-4 animate-check-in text-accent" strokeWidth={2} />
            Sent to Rahul — it’s in your updates.
          </span>
        )}
      </p>
      {error && <ErrorText>{error}</ErrorText>}
    </form>
  );
}
