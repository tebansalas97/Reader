export interface PageSlot {
  index: number;
  top: number;
  height: number;
}

export interface VisibleRange {
  first: number;
  last: number;
  renderFirst: number;
  renderLast: number;
}

export function pageSlots(heights: number[], gap: number): PageSlot[] {
  const slots: PageSlot[] = [];
  let top = 0;
  for (let index = 0; index < heights.length; index += 1) {
    const height = Math.max(0, heights[index] ?? 0);
    slots.push({ index, top, height });
    top += height + gap;
  }
  return slots;
}

export function totalHeight(heights: number[], gap: number): number {
  if (heights.length === 0) return 0;
  const sum = heights.reduce((acc, h) => acc + Math.max(0, h), 0);
  return sum + gap * (heights.length - 1);
}

export function pageAtOffset(slots: PageSlot[], offset: number): number {
  if (slots.length === 0) return 0;
  if (offset <= 0) return 0;
  let index = 0;
  for (let i = 0; i < slots.length; i += 1) {
    if (slots[i]!.top <= offset) index = i;
    else break;
  }
  return index;
}

export function visibleRange(
  heights: number[],
  scrollTop: number,
  viewport: number,
  overscan = 2,
  gap = 16,
): VisibleRange {
  if (heights.length === 0) {
    return { first: 0, last: -1, renderFirst: 0, renderLast: -1 };
  }

  const slots = pageSlots(heights, gap);
  const top = Math.max(0, scrollTop);
  const bottom = top + Math.max(0, viewport);

  let first = -1;
  let last = -1;
  for (const slot of slots) {
    const slotBottom = slot.top + slot.height;
    if (slotBottom <= top) continue;
    if (slot.top >= bottom) break;
    if (first === -1) first = slot.index;
    last = slot.index;
  }

  if (first === -1) {
    const nearest = pageAtOffset(slots, top);
    first = nearest;
    last = nearest;
  }

  const limit = heights.length - 1;
  return {
    first,
    last,
    renderFirst: Math.max(0, first - overscan),
    renderLast: Math.min(limit, last + overscan),
  };
}

export function offsetOfPage(heights: number[], page: number, gap = 16): number {
  const slots = pageSlots(heights, gap);
  const index = Math.min(Math.max(0, page), Math.max(0, slots.length - 1));
  return slots[index]?.top ?? 0;
}

export function shouldKeep(range: VisibleRange, index: number): boolean {
  return index >= range.renderFirst && index <= range.renderLast;
}
