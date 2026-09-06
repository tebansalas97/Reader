import { describe, expect, it, vi } from 'vitest';
import {
  buildLineMap,
  createSyncGuard,
  lineForPreviewTop,
  previewTopForLine,
  type LineAnchor,
} from './scroll-sync';

const map: LineAnchor[] = [
  { line: 0, top: 0, height: 40 },
  { line: 4, top: 40, height: 100 },
  { line: 10, top: 140, height: 60 },
];

describe('buildLineMap', () => {
  it('reads data-line from the rendered blocks', () => {
    const root = document.createElement('div');
    root.innerHTML = '<h1 data-line="0">a</h1><p data-line="3">b</p>';
    expect(buildLineMap(root).map((a) => a.line)).toEqual([0, 3]);
  });

  it('ignores nodes without data-line', () => {
    const root = document.createElement('div');
    root.innerHTML = '<h1 data-line="0">a</h1><p>b</p>';
    expect(buildLineMap(root)).toHaveLength(1);
  });

  it('ignores a non-numeric data-line', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p data-line="abc">a</p>';
    expect(buildLineMap(root)).toHaveLength(0);
  });

  it('sorts anchors by line', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p data-line="5">b</p><p data-line="1">a</p>';
    expect(buildLineMap(root).map((a) => a.line)).toEqual([1, 5]);
  });
});

describe('previewTopForLine', () => {
  it('returns the exact top for an anchor line', () => {
    expect(previewTopForLine(map, 4)).toBe(40);
  });

  it('interpolates inside a block', () => {
    expect(previewTopForLine(map, 7)).toBe(90);
  });

  it('clamps before the first anchor', () => {
    expect(previewTopForLine(map, -3)).toBe(0);
  });

  it('returns the last anchor top past the end', () => {
    expect(previewTopForLine(map, 999)).toBe(140);
  });

  it('returns zero for an empty map', () => {
    expect(previewTopForLine([], 5)).toBe(0);
  });
});

describe('lineForPreviewTop', () => {
  it('inverts previewTopForLine at anchor points', () => {
    expect(lineForPreviewTop(map, 40)).toBe(4);
  });

  it('interpolates inside a block', () => {
    expect(lineForPreviewTop(map, 90)).toBe(7);
  });

  it('clamps to the first line above the map', () => {
    expect(lineForPreviewTop(map, -20)).toBe(0);
  });

  it('returns the last line past the end', () => {
    expect(lineForPreviewTop(map, 5000)).toBe(10);
  });

  it('returns zero for an empty map', () => {
    expect(lineForPreviewTop([], 100)).toBe(0);
  });
});

describe('createSyncGuard', () => {
  it('lets the first claimer through', () => {
    expect(createSyncGuard().claim('editor')).toBe(true);
  });

  it('blocks the other side while a claim is active', () => {
    const guard = createSyncGuard();
    guard.claim('editor');
    expect(guard.claim('preview')).toBe(false);
  });

  it('lets the same side keep scrolling', () => {
    const guard = createSyncGuard();
    guard.claim('editor');
    expect(guard.claim('editor')).toBe(true);
  });

  it('releases after the quiet period', () => {
    vi.useFakeTimers();
    const guard = createSyncGuard(100);
    guard.claim('editor');
    vi.advanceTimersByTime(150);
    expect(guard.claim('preview')).toBe(true);
    vi.useRealTimers();
  });

  it('releases immediately when asked', () => {
    const guard = createSyncGuard();
    guard.claim('editor');
    guard.release();
    expect(guard.claim('preview')).toBe(true);
  });
});
