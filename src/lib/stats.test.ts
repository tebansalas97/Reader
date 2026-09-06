import { describe, expect, it } from 'vitest';
import { countChars, countWords, readingMinutes } from './stats';

describe('countWords', () => {
  it('counts plain words', () => {
    expect(countWords('uno dos tres')).toBe(3);
  });

  it('ignores extra whitespace and newlines', () => {
    expect(countWords('  uno \n\n dos  ')).toBe(2);
  });

  it('returns zero for an empty document', () => {
    expect(countWords('')).toBe(0);
  });

  it('counts words with accents as one word', () => {
    expect(countWords('canción número')).toBe(2);
  });

  it('does not count markdown punctuation as words', () => {
    expect(countWords('# Título\n\n- uno')).toBe(2);
  });
});

describe('countChars', () => {
  it('counts every character including spaces', () => {
    expect(countChars('a b')).toBe(3);
  });

  it('counts an emoji as one character', () => {
    expect(countChars('🙂')).toBe(1);
  });
});

describe('readingMinutes', () => {
  it('rounds up to at least one minute', () => {
    expect(readingMinutes(10)).toBe(1);
  });

  it('uses two hundred words per minute', () => {
    expect(readingMinutes(600)).toBe(3);
  });

  it('returns zero for an empty document', () => {
    expect(readingMinutes(0)).toBe(0);
  });
});
