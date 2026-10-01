import { describe, it, expect, beforeEach } from 'vitest';
import { roleFromToken, roleFromBearer } from '@/lib/auth';

beforeEach(() => {
  process.env.STUDENT_TOKEN = 'stu-secret';
  process.env.COACH_TOKEN = 'coach-secret';
});

describe('roleFromToken', () => {
  it('maps the student token', () => expect(roleFromToken('stu-secret')).toBe('student'));
  it('maps the coach token', () => expect(roleFromToken('coach-secret')).toBe('coach'));
  it('rejects unknown / empty tokens', () => {
    expect(roleFromToken('nope')).toBeNull();
    expect(roleFromToken('')).toBeNull();
  });
});

describe('roleFromBearer (player API: Authorization: Bearer <student token>)', () => {
  it('maps a bearer student token', () => expect(roleFromBearer('Bearer stu-secret')).toBe('student'));
  it('accepts any casing of the scheme and surrounding spaces', () => expect(roleFromBearer('  bearer   stu-secret ')).toBe('student'));
  it('rejects missing, malformed and unknown credentials', () => {
    expect(roleFromBearer(null)).toBeNull();
    expect(roleFromBearer('')).toBeNull();
    expect(roleFromBearer('stu-secret')).toBeNull(); // no scheme
    expect(roleFromBearer('Basic stu-secret')).toBeNull();
    expect(roleFromBearer('Bearer ')).toBeNull();
    expect(roleFromBearer('Bearer nope')).toBeNull();
  });
  it('fails closed when the env token is unset', () => {
    process.env.STUDENT_TOKEN = '';
    expect(roleFromBearer('Bearer ')).toBeNull();
    expect(roleFromBearer('Bearer stu-secret')).toBeNull();
  });
});
