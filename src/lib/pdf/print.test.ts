import { describe, expect, it } from 'vitest';
import type { PageSize } from './document';
import { MAX_PRINT_SIDE, printScale, PRINT_DPI, renderForPrint } from './print';

const LETTER: PageSize = { width: 612, height: 792, rotation: 0 };
const HUGE: PageSize = { width: 6000, height: 9000, rotation: 0 };

describe('printScale', () => {
  it('prints at the resolution asked for', () => {
    expect(printScale(LETTER, 0)).toBeCloseTo(PRINT_DPI / 72, 5);
  });

  it('drops the resolution before making a bitmap too big to handle', () => {
    const scale = printScale(HUGE, 0);
    expect(9000 * scale).toBeCloseTo(MAX_PRINT_SIDE, 5);
  });

  it('measures the page as it will be printed, already turned', () => {
    const wide: PageSize = { width: 9000, height: 100, rotation: 0 };
    expect(printScale(wide, 90)).toBe(printScale(wide, 0));
  });

  it('survives a page with no size', () => {
    expect(printScale({ width: 0, height: 0, rotation: 0 }, 0)).toBe(1);
  });
});

describe('renderForPrint', () => {
  it('gives nothing when the browser cannot draw', async () => {
    const handle = {
      pageCount: 2,
      pageSizes: [LETTER, LETTER],
      encrypted: false,
      outline: async () => [],
      page: async () => ({}) as never,
      hideFromCanvas: () => undefined,
      showOnCanvas: () => undefined,
      destroy: async () => undefined,
    };
    expect(await renderForPrint(handle, 0)).toEqual([]);
  });
});
