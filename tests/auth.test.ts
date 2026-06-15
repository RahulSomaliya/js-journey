import { describe, it, expect, beforeEach } from 'vitest';
import { roleFromToken } from '@/lib/auth';

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
