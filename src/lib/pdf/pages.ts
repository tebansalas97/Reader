import type { Annotation } from './annotations/model';

export type Quarter = 0 | 90 | 180 | 270;

export interface PageEdit {
  source: number;
  rotation: Quarter;
}

export function initialPlan(count: number): PageEdit[] {
  const plan: PageEdit[] = [];
  for (let page = 1; page <= Math.max(0, count); page += 1) {
    plan.push({ source: page, rotation: 0 });
  }
  return plan;
}

export function samePlan(a: PageEdit[], b: PageEdit[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return other !== undefined && entry.source === other.source && entry.rotation === other.rotation;
  });
}

function chosen(plan: PageEdit[], selected: number[]): number[] {
  const inside = selected.filter((index) => index >= 0 && index < plan.length);
  return [...new Set(inside)].sort((a, b) => a - b);
}

export function movePages(plan: PageEdit[], selected: number[], to: number): PageEdit[] {
  const picked = chosen(plan, selected);
  if (picked.length === 0) return plan;

  const target = Math.min(Math.max(0, to), plan.length);
  const before = picked.filter((index) => index < target).length;
  const moving = picked.map((index) => plan[index]!);
  const rest = plan.filter((_, index) => !picked.includes(index));
  return [...rest.slice(0, target - before), ...moving, ...rest.slice(target - before)];
}

export function removePages(plan: PageEdit[], selected: number[]): PageEdit[] {
  const picked = chosen(plan, selected);
  if (picked.length === 0 || picked.length >= plan.length) return plan;
  return plan.filter((_, index) => !picked.includes(index));
}

export function turnPages(plan: PageEdit[], selected: number[], quarters: 1 | -1): PageEdit[] {
  const picked = new Set(chosen(plan, selected));
  if (picked.size === 0) return plan;
  return plan.map((entry, index) => {
    if (!picked.has(index)) return entry;
    const next = (((entry.rotation + quarters * 90) % 360) + 360) % 360;
    return { ...entry, rotation: next as Quarter };
  });
}

export function sourcesOf(plan: PageEdit[]): number[] {
  return plan.map((entry) => entry.source);
}

export function positionOfSource(plan: PageEdit[], source: number): number {
  const index = plan.findIndex((entry) => entry.source === source);
  return index < 0 ? 0 : index + 1;
}

export function keptSources(plan: PageEdit[]): Set<number> {
  return new Set(plan.map((entry) => entry.source));
}

export function annotationsOnLostPages(
  annotations: Annotation[],
  plan: PageEdit[],
): Annotation[] {
  const kept = keptSources(plan);
  return annotations.filter((annotation) => !kept.has(annotation.page));
}

export function withoutLostPages(annotations: Annotation[], plan: PageEdit[]): Annotation[] {
  const kept = keptSources(plan);
  return annotations.filter((annotation) => kept.has(annotation.page));
}

export function planAfterSave(plan: PageEdit[]): PageEdit[] {
  return plan.map((_, index) => ({ source: index + 1, rotation: 0 }));
}

export interface DropBox {
  top: number;
  bottom: number;
}

export function dropIndexAt(boxes: DropBox[], y: number): number {
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index]!;
    if (y < (box.top + box.bottom) / 2) return index;
  }
  return boxes.length;
}

export function rangeBetween(from: number, to: number): number[] {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const list: number[] = [];
  for (let index = start; index <= end; index += 1) list.push(index);
  return list;
}

export function toggleIn(selected: number[], index: number): number[] {
  return selected.includes(index)
    ? selected.filter((entry) => entry !== index)
    : [...selected, index].sort((a, b) => a - b);
}
