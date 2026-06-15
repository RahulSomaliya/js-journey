export type Role = 'student' | 'coach';
export const ROLE_COOKIE = 'journey_role';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function roleFromToken(token: string): Role | null {
  const student = process.env.STUDENT_TOKEN ?? '';
  const coach = process.env.COACH_TOKEN ?? '';
  if (token && student && safeEqual(token, student)) return 'student';
  if (token && coach && safeEqual(token, coach)) return 'coach';
  return null;
}
