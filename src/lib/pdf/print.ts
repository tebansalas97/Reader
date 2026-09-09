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

export async function renderForPrint(
  handle: PdfHandle,
  rotation: number,
  onprogress?: PrintProgress,
): Promise<string[]> {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return [];

  const images: string[] = [];
  for (let number = 1; number <= handle.pageCount; number += 1) {
    const page = await handle.page(number);
    const size = handle.pageSizes[number - 1];
    const scale = size ? printScale(size, rotation) : 1;
    const viewport = page.getViewport({ scale, rotation: page.rotate + rotation });

    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.9));
    onprogress?.(number, handle.pageCount);
  }

  canvas.width = 0;
  canvas.height = 0;
  return images;
}
