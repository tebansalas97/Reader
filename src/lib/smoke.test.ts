import { describe, expect, it } from 'vitest';

describe('test runner', () => {
  it('runs in jsdom', () => {
    expect(typeof document).toBe('object');
  });
});
