import { describe, expect, it } from 'vitest';
import type { Annotation } from './annotations/model';
import {
  annotationsOnLostPages,
  dropIndexAt,
  rangeBetween,
  toggleIn,
  initialPlan,
  keptSources,
  movePages,
  planAfterSave,
  positionOfSource,
  removePages,
  samePlan,
  sourcesOf,
  turnPages,
  withoutLostPages,
  type PageEdit,
} from './pages';

const PLAN = initialPlan(5);

function mark(page: number): Annotation {
  return {
    id: `a${page}`,
    page,
    kind: 'highlight',
    color: '#ffd400',
    opacity: 0.4,
    contents: '',
    author: '',
    createdMs: 0,
    origin: 'file',
    ref: `${page}R`,
  };
}

describe('initialPlan', () => {
  it('lists every page in order', () => {
    expect(sourcesOf(initialPlan(3))).toEqual([1, 2, 3]);
  });

  it('starts with no extra rotation', () => {
    expect(initialPlan(2).every((entry) => entry.rotation === 0)).toBe(true);
  });

  it('makes nothing out of nothing', () => {
    expect(initialPlan(0)).toEqual([]);
    expect(initialPlan(-4)).toEqual([]);
  });
});

describe('samePlan', () => {
  it('knows a plan that has not been touched', () => {
    expect(samePlan(PLAN, initialPlan(5))).toBe(true);
  });

  it('sees a page that moved', () => {
    expect(samePlan(PLAN, movePages(PLAN, [0], 3))).toBe(false);
  });

  it('sees a page that was turned', () => {
    expect(samePlan(PLAN, turnPages(PLAN, [0], 1))).toBe(false);
  });

  it('sees a page that is gone', () => {
    expect(samePlan(PLAN, removePages(PLAN, [0]))).toBe(false);
  });
});

describe('movePages', () => {
  it('moves one page forward', () => {
    expect(sourcesOf(movePages(PLAN, [0], 3))).toEqual([2, 3, 1, 4, 5]);
  });

  it('moves one page back', () => {
    expect(sourcesOf(movePages(PLAN, [4], 0))).toEqual([5, 1, 2, 3, 4]);
  });

  it('moves several pages together and keeps their order', () => {
    expect(sourcesOf(movePages(PLAN, [0, 1], 4))).toEqual([3, 4, 1, 2, 5]);
  });

  it('moves a scattered selection together', () => {
    expect(sourcesOf(movePages(PLAN, [0, 4], 2))).toEqual([2, 1, 5, 3, 4]);
  });

  it('leaves the plan alone when nothing is selected', () => {
    expect(movePages(PLAN, [], 2)).toBe(PLAN);
  });

  it('ignores an index that is not there', () => {
    expect(movePages(PLAN, [99], 2)).toBe(PLAN);
  });

  it('takes a target past the end as the end', () => {
    expect(sourcesOf(movePages(PLAN, [0], 99))).toEqual([2, 3, 4, 5, 1]);
  });

  it('dropping a page where it already is changes nothing', () => {
    expect(sourcesOf(movePages(PLAN, [2], 2))).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('removePages', () => {
  it('takes a page out', () => {
    expect(sourcesOf(removePages(PLAN, [1]))).toEqual([1, 3, 4, 5]);
  });

  it('takes several out at once', () => {
    expect(sourcesOf(removePages(PLAN, [0, 4]))).toEqual([2, 3, 4]);
  });

  it('refuses to leave the document with no pages', () => {
    expect(removePages(PLAN, [0, 1, 2, 3, 4])).toBe(PLAN);
  });

  it('leaves the plan alone when nothing is selected', () => {
    expect(removePages(PLAN, [])).toBe(PLAN);
  });
});

describe('turnPages', () => {
  it('turns a page a quarter to the right', () => {
    expect(turnPages(PLAN, [0], 1)[0]?.rotation).toBe(90);
  });

  it('turns it back to the left', () => {
    expect(turnPages(turnPages(PLAN, [0], 1), [0], -1)[0]?.rotation).toBe(0);
  });

  it('wraps around a full turn', () => {
    let plan: PageEdit[] = PLAN;
    for (let i = 0; i < 4; i += 1) plan = turnPages(plan, [0], 1);
    expect(plan[0]?.rotation).toBe(0);
  });

  it('goes round the other way past zero', () => {
    expect(turnPages(PLAN, [0], -1)[0]?.rotation).toBe(270);
  });

  it('leaves the pages that were not chosen', () => {
    expect(turnPages(PLAN, [0], 1)[1]?.rotation).toBe(0);
  });
});

describe('where a page ended up', () => {
  it('finds the new position of a page', () => {
    expect(positionOfSource(movePages(PLAN, [0], 3), 1)).toBe(3);
  });

  it('says nothing for a page that was removed', () => {
    expect(positionOfSource(removePages(PLAN, [0]), 1)).toBe(0);
  });

  it('lists the pages that are still there', () => {
    expect([...keptSources(removePages(PLAN, [0]))]).toEqual([2, 3, 4, 5]);
  });
});

describe('annotations of pages that go away', () => {
  const marks = [mark(1), mark(2), mark(5)];

  it('finds the ones that would be lost', () => {
    const plan = removePages(PLAN, [0]);
    expect(annotationsOnLostPages(marks, plan).map((a) => a.page)).toEqual([1]);
  });

  it('finds none when no page is removed', () => {
    expect(annotationsOnLostPages(marks, movePages(PLAN, [0], 3))).toEqual([]);
  });

  it('keeps the rest', () => {
    const plan = removePages(PLAN, [0]);
    expect(withoutLostPages(marks, plan).map((a) => a.page)).toEqual([2, 5]);
  });
});

describe('planAfterSave', () => {
  it('starts again from the file that was just written', () => {
    const plan = movePages(turnPages(PLAN, [0], 1), [0], 3);
    expect(planAfterSave(plan)).toEqual(initialPlan(5));
  });
});

describe('dropIndexAt', () => {
  const boxes = [
    { top: 0, bottom: 100 },
    { top: 100, bottom: 200 },
    { top: 200, bottom: 300 },
  ];

  it('drops before the first page', () => {
    expect(dropIndexAt(boxes, 10)).toBe(0);
  });

  it('drops between two pages', () => {
    expect(dropIndexAt(boxes, 140)).toBe(1);
  });

  it('drops after a page once the pointer passes its middle', () => {
    expect(dropIndexAt(boxes, 160)).toBe(2);
  });

  it('drops after the last page', () => {
    expect(dropIndexAt(boxes, 290)).toBe(3);
  });

  it('drops at the end when the list is empty', () => {
    expect(dropIndexAt([], 10)).toBe(0);
  });
});

describe('selecting', () => {
  it('takes the whole range between two pages', () => {
    expect(rangeBetween(3, 1)).toEqual([1, 2, 3]);
  });

  it('takes one page as a range of one', () => {
    expect(rangeBetween(2, 2)).toEqual([2]);
  });

  it('adds a page that was not selected', () => {
    expect(toggleIn([0, 2], 1)).toEqual([0, 1, 2]);
  });

  it('takes out one that was', () => {
    expect(toggleIn([0, 1, 2], 1)).toEqual([0, 2]);
  });
});
