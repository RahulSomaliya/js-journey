// Next 16: the `middleware` file convention was renamed to `proxy` (v16.0.0).
import { NextRequest, NextResponse } from 'next/server';
import { roleFromToken, ROLE_COOKIE } from '@/lib/auth';

// single segment, not :token*. Deliberately NOT /api/*: the Course Player API
// (app/api/player/*) authenticates itself with `Authorization: Bearer <student token>`,
// and this proxy would 404 it (seg[0] = 'api' is neither 'm' nor 'r'). tests/player-api.test.ts guards it.
export const config = { matcher: ['/m/:token', '/r/:token'] };

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const seg = pathname.split('/').filter(Boolean); // ['m', token] or ['r', token]
  const token = seg[1] ?? '';
  const role = roleFromToken(token);
  const expected = seg[0] === 'm' ? 'student' : 'coach';
  if (!role || role !== expected) {
    return new NextResponse('Not found', { status: 404 });
  }
  const res = NextResponse.next();
  // secure conditional: a Secure cookie is NOT stored over http://localhost in Safari, breaking local verify.
  res.cookies.set(ROLE_COOKIE, role, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  return res;
}
