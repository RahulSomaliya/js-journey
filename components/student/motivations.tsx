// 30 simple, warm lines — a few personalised for Mansi (and from Rahul).
// One line is chosen per render; the page is force-dynamic, so it's stable for
// the session and only changes on a refresh.
const LINES = [
  'You’re closer than you were yesterday, Mansi.',
  'One line of code at a time — that’s all it takes.',
  'Every expert was once a beginner. Keep going.',
  'Showing up today is already a win.',
  'Mansi, your future self is cheering for you.',
  'Small steps every day build big things.',
  'Confused now means clever soon. Push through.',
  'You don’t have to be perfect — just consistent.',
  'Two focused hours beat ten distracted ones.',
  'Bugs are just lessons wearing a disguise.',
  'Mansi, you’ve got a brain built for this.',
  'Progress over perfection. Always.',
  'The hard parts are where the growth hides.',
  'You’re building a real skill, one day at a time.',
  'Keep that streak alive — you’re on fire.',
  'Believe it: you can absolutely do this, Mansi.',
  'Today’s effort is tomorrow’s confidence.',
  'Done is better than perfect. Just log it.',
  'Every section you finish opens a new door.',
  'Rahul’s proud of you — and so is future Mansi.',
  'Slow progress is still progress. Trust it.',
  'You learn JavaScript by writing JavaScript. Go.',
  'Mistakes mean you’re trying. Keep trying.',
  'Your consistency is your superpower.',
  'One more lesson — you’ve always got one more in you.',
  'The phone can wait. Your dream can’t. Let’s go.',
  'Mansi, learning is the bravest thing you can do.',
  'Curiosity got you here. Let it carry you forward.',
  'You’re not behind — you’re right on your own path.',
  'Make today count. Future Mansi will thank you.',
];

export function Motivations() {
  // Intentional per-request pick: this renders only inside the force-dynamic
  // student page, so it's re-evaluated on every refresh (fresh quote each load,
  // stable for the session). Not a client component → no React-Compiler purity concern.
  // eslint-disable-next-line react-hooks/purity
  const line = LINES[Math.floor(Math.random() * LINES.length)];
  return (
    <figure className="mx-auto max-w-md text-center">
      <blockquote className="font-serif text-lg italic leading-relaxed text-ink-2">
        <span aria-hidden className="mr-1 align-[-0.4em] font-serif text-4xl not-italic leading-none" style={{ color: 'var(--accent)' }}>
          “
        </span>
        {line}
        <span aria-hidden className="ml-1 align-[-0.55em] font-serif text-4xl not-italic leading-none" style={{ color: 'var(--accent)' }}>
          ”
        </span>
      </blockquote>
    </figure>
  );
}
