import { newAnnotationId, type Annotation } from './model';
import { movedBy } from './transform';

export const COPY_OFFSET = 12;

export function toggleSelection(
  current: readonly string[],
  id: string,
  additive: boolean,
): string[] {
  if (!additive) return current.length === 1 && current[0] === id ? [...current] : [id];
  return current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
}

export function copyable(annotation: Annotation): boolean {
  return annotation.kind !== 'stamp' || typeof annotation.image === 'string';
}

export function copyOf(annotation: Annotation, offset = COPY_OFFSET): Annotation | null {
  if (!copyable(annotation)) return null;
  const copy: Annotation = {
    ...movedBy(annotation, offset, -offset),
    id: newAnnotationId(),
    origin: 'reader',
    createdMs: Date.now(),
  };
  delete copy.ref;
  return copy;
}

export function copiesOf(
  annotations: readonly Annotation[],
  ids: readonly string[],
  offset = COPY_OFFSET,
): Annotation[] {
  const wanted = new Set(ids);
  const made: Annotation[] = [];
  for (const annotation of annotations) {
    if (!wanted.has(annotation.id)) continue;
    const copy = copyOf(annotation, offset);
    if (copy) made.push(copy);
  }
  return made;
}

export function movedGroup(
  annotations: readonly Annotation[],
  ids: readonly string[],
  dx: number,
  dy: number,
): Annotation[] {
  const wanted = new Set(ids);
  const moved: Annotation[] = [];
  for (const annotation of annotations) {
    if (wanted.has(annotation.id)) moved.push(movedBy(annotation, dx, dy));
  }
  return moved;
}
