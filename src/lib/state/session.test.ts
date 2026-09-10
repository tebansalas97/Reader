import { describe, expect, it } from 'vitest';
import { MAX_SESSION, pathsToRestore, sameSession, sessionPaths } from './session';

describe('sessionPaths', () => {
  it('keeps the paths of the open documents in order', () => {
    expect(sessionPaths([{ path: 'a.md' }, { path: 'b.pdf' }])).toEqual(['a.md', 'b.pdf']);
  });

  it('leaves out documents that were never saved', () => {
    expect(sessionPaths([{ path: null }, { path: 'b.pdf' }])).toEqual(['b.pdf']);
  });

  it('does not repeat a path opened twice', () => {
    expect(sessionPaths([{ path: 'a.md' }, { path: 'a.md' }])).toEqual(['a.md']);
  });

  it('stops at the limit', () => {
    const many = Array.from({ length: MAX_SESSION + 5 }, (_, index) => ({ path: `${index}.md` }));
    expect(sessionPaths(many)).toHaveLength(MAX_SESSION);
  });
});

describe('pathsToRestore', () => {
  it('returns the stored session when nothing came from the command line', () => {
    expect(pathsToRestore(['a.md'], [], true)).toEqual(['a.md']);
  });

  it('returns nothing when the preference is off', () => {
    expect(pathsToRestore(['a.md'], [], false)).toEqual([]);
  });

  it('yields to the paths given on the command line', () => {
    expect(pathsToRestore(['a.md'], ['b.md'], true)).toEqual([]);
  });

  it('drops empty entries', () => {
    expect(pathsToRestore(['', 'a.md'], [], true)).toEqual(['a.md']);
  });
});

describe('sameSession', () => {
  it('sees two equal lists', () => {
    expect(sameSession(['a.md'], ['a.md'])).toBe(true);
  });

  it('sees a different order', () => {
    expect(sameSession(['a.md', 'b.md'], ['b.md', 'a.md'])).toBe(false);
  });

  it('sees a different length', () => {
    expect(sameSession(['a.md'], [])).toBe(false);
  });
});
