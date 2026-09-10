import { describe, expect, it } from 'vitest';
import type { PdfSnapshot } from './undo.svelte';
import { COALESCE_MS, MAX_STEPS, sameStep, snapshotOf, trimmed, undo } from './undo.svelte';

function state(n: number): PdfSnapshot {
  return {
    annotations: [{ id: `a${n}` } as never],
    pages: [{ source: n, rotation: 0 }],
    fieldValues: { campo: String(n) },
    edits: [],
  };
}

describe('snapshotOf', () => {
  it('copies the lists so a later change does not touch the step', () => {
    const source = state(1);
    const kept = snapshotOf(source);
    source.annotations.push({ id: 'otra' } as never);
    expect(kept.annotations).toHaveLength(1);
  });

  it('keeps the same objects inside, which is lo que lo hace barato', () => {
    const source = state(1);
    expect(snapshotOf(source).annotations[0]).toBe(source.annotations[0]);
  });
});

describe('sameStep', () => {
  it('joins two changes of the same thing hechas seguidas', () => {
    expect(sameStep({ tag: 'field:a', at: 1000, state: state(1) }, 'field:a', 1200)).toBe(true);
  });

  it('separates them when pasa el tiempo', () => {
    expect(
      sameStep({ tag: 'field:a', at: 1000, state: state(1) }, 'field:a', 1000 + COALESCE_MS + 1),
    ).toBe(false);
  });

  it('never joins two cosas distintas', () => {
    expect(sameStep({ tag: 'field:a', at: 1000, state: state(1) }, 'field:b', 1100)).toBe(false);
  });

  it('never joins pasos sin etiqueta', () => {
    expect(sameStep({ tag: '', at: 1000, state: state(1) }, '', 1100)).toBe(false);
  });
});

describe('trimmed', () => {
  it('leaves a short history alone', () => {
    const steps = [{ tag: 'a', at: 1, state: state(1) }];
    expect(trimmed(steps)).toBe(steps);
  });

  it('drops the oldest when it grows past the limit', () => {
    const steps = Array.from({ length: MAX_STEPS + 5 }, (_, i) => ({
      tag: `t${i}`,
      at: i,
      state: state(i),
    }));
    const kept = trimmed(steps);
    expect(kept).toHaveLength(MAX_STEPS);
    expect(kept[0]?.tag).toBe('t5');
  });
});

describe('undo store', () => {
  it('goes back to the state before the change', () => {
    undo.forget('d1');
    undo.record('d1', 'x', state(1));
    expect(undo.undo('d1', state(2))?.pages[0]?.source).toBe(1);
  });

  it('has nothing to undo at the start', () => {
    undo.forget('d2');
    expect(undo.canUndo('d2')).toBe(false);
    expect(undo.undo('d2', state(1))).toBeNull();
  });

  it('redoes what it just undid', () => {
    undo.forget('d3');
    undo.record('d3', 'x', state(1));
    undo.undo('d3', state(2));
    expect(undo.canRedo('d3')).toBe(true);
    expect(undo.redo('d3', state(1))?.pages[0]?.source).toBe(2);
  });

  it('forgets the redo once something new happens', () => {
    undo.forget('d4');
    undo.record('d4', 'x', state(1));
    undo.undo('d4', state(2));
    undo.record('d4', 'y', state(3));
    expect(undo.canRedo('d4')).toBe(false);
  });

  it('keeps one history per document', () => {
    undo.forget('d5');
    undo.forget('d6');
    undo.record('d5', 'x', state(1));
    expect(undo.canUndo('d5')).toBe(true);
    expect(undo.canUndo('d6')).toBe(false);
  });

  it('joins the keystrokes of the same field into one step', () => {
    undo.forget('d7');
    undo.record('d7', 'field:a', state(1), 1000);
    undo.record('d7', 'field:a', state(2), 1100);
    undo.record('d7', 'field:a', state(3), 1200);
    undo.undo('d7', state(4));
    expect(undo.canUndo('d7')).toBe(false);
  });

  it('forgets everything when the document closes', () => {
    undo.forget('d8');
    undo.record('d8', 'x', state(1));
    undo.forget('d8');
    expect(undo.canUndo('d8')).toBe(false);
  });
});
