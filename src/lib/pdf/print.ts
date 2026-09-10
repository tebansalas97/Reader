import type { PageSize, PdfHandle } from './document';
import { rotatedSize } from './render';

export const PRINT_DPI = 150;
export const MAX_PRINT_SIDE = 4200;
export const MANY_PAGES = 50;

export function printScale(size: PageSize, rotation: number, dpi = PRINT_DPI): number {
  const page = rotatedSize(size, rotation);
  const longest = Math.max(page.width, page.height);
  if (longest <= 0) return 1;
  const wanted = dpi / 72;
  return Math.min(wanted, MAX_PRINT_SIDE / longest);
}

export interface PrintProgress {
  (done: number, total: number): void;
}

export interface PrintPage {
  source: number;
  rotation: number;
}

export function printPlan(
  plan: readonly PrintPage[],
  positions: readonly number[],
): PrintPage[] {
  return positions
    .map((position) => plan[position - 1])
    .filter((entry): entry is PrintPage => entry !== undefined);
}

export async function renderForPrint(
  handle: PdfHandle,
  rotation: number,
  plan: readonly PrintPage[],
  onprogress?: PrintProgress,
): Promise<string[]> {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return [];

  const images: string[] = [];
  const total = plan.length;
  for (const [index, entry] of plan.entries()) {
    const page = await handle.page(entry.source);
    const size = handle.pageSizes[entry.source - 1];
    const turn = rotation + entry.rotation;
    const scale = size ? printScale(size, turn) : 1;
    const viewport = page.getViewport({ scale, rotation: (size?.rotation ?? 0) + turn });

    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.9));
    onprogress?.(index + 1, total);
  }

  canvas.width = 0;
  canvas.height = 0;
  return images;
}
