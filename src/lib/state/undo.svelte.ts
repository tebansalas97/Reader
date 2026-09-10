import type { Annotation } from '$lib/pdf/annotations/model';
import type { TextEdit } from '$lib/pdf/edit/document';
import type { FieldValues } from '$lib/pdf/forms/model';
import type { PageEdit } from '$lib/pdf/pages';

export interface PdfSnapshot {
  annotations: Annotation[];
  pages: PageEdit[];
  fieldValues: FieldValues;
  edits: TextEdit[];
}

export interface Step {
  tag: string;
  at: number;
  state: PdfSnapshot;
}

export const MAX_STEPS = 50;
export const COALESCE_MS = 600;

export function snapshotOf(source: PdfSnapshot): PdfSnapshot {
  return {
    annotations: [...source.annotations],
    pages: [...source.pages],
    fieldValues: { ...source.fieldValues },
    edits: [...source.edits],
  };
}

export function sameStep(step: Step, tag: string, now: number): boolean {
  return step.tag === tag && tag !== '' && now - step.at < COALESCE_MS;
}

export function trimmed(steps: Step[]): Step[] {
  return steps.length > MAX_STEPS ? steps.slice(steps.length - MAX_STEPS) : steps;
}

interface Lane {
  past: Step[];
  future: Step[];
}

class UndoStore {
  private lanes = new Map<string, Lane>();
  private stamp = $state(0);

  private lane(id: string): Lane {
    const known = this.lanes.get(id);
    if (known) return known;
    const made: Lane = { past: [], future: [] };
    this.lanes.set(id, made);
    return made;
  }

  record(id: string, tag: string, state: PdfSnapshot, now = Date.now()): void {
    const lane = this.lane(id);
    const last = lane.past[lane.past.length - 1];
    lane.future = [];

    if (last && sameStep(last, tag, now)) {
      last.at = now;
      this.stamp += 1;
      return;
    }

    lane.past = trimmed([...lane.past, { tag, at: now, state: snapshotOf(state) }]);
    this.stamp += 1;
  }

  undo(id: string, current: PdfSnapshot): PdfSnapshot | null {
    const lane = this.lane(id);
    const step = lane.past.pop();
    if (!step) return null;
    lane.future = trimmed([...lane.future, { tag: step.tag, at: Date.now(), state: snapshotOf(current) }]);
    this.stamp += 1;
    return step.state;
  }

  redo(id: string, current: PdfSnapshot): PdfSnapshot | null {
    const lane = this.lane(id);
    const step = lane.future.pop();
    if (!step) return null;
    lane.past = trimmed([...lane.past, { tag: step.tag, at: Date.now(), state: snapshotOf(current) }]);
    this.stamp += 1;
    return step.state;
  }

  canUndo(id: string): boolean {
    void this.stamp;
    return (this.lanes.get(id)?.past.length ?? 0) > 0;
  }

  canRedo(id: string): boolean {
    void this.stamp;
    return (this.lanes.get(id)?.future.length ?? 0) > 0;
  }

  forget(id: string): void {
    this.lanes.delete(id);
    this.stamp += 1;
  }
}

export const undo = new UndoStore();
