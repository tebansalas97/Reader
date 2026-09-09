import type { PDFPageProxy, RenderTask } from 'pdfjs-dist';
import type { PageSize } from './document';

export type ZoomMode = number | 'fit-width' | 'fit-page';

export interface Viewport {
  width: number;
  height: number;
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function rotatedSize(size: PageSize, rotation: number): Viewport {
  const total = (((size.rotation + rotation) % 360) + 360) % 360;
  const swapped = total === 90 || total === 270;
  return {
    width: swapped ? size.height : size.width,
    height: swapped ? size.width : size.height,
  };
}

export function scaleFor(
  size: PageSize,
  mode: ZoomMode,
  viewport: Viewport,
  rotation = 0,
  padding = 0,
): number {
  if (typeof mode === 'number') return clampScale(mode);

  const page = rotatedSize(size, rotation);
  if (page.width === 0 || page.height === 0) return 1;

  const width = Math.max(1, viewport.width - padding * 2);
  if (mode === 'fit-width') return clampScale(width / page.width);

  const height = Math.max(1, viewport.height - padding * 2);
  return clampScale(Math.min(width / page.width, height / page.height));
}

export function canvasSize(size: PageSize, scale: number, rotation: number, ratio: number): {
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
} {
  const page = rotatedSize(size, rotation);
  const cssWidth = Math.max(1, Math.round(page.width * scale));
  const cssHeight = Math.max(1, Math.round(page.height * scale));
  const density = Math.min(3, Math.max(1, ratio));
  return {
    cssWidth,
    cssHeight,
    pixelWidth: Math.round(cssWidth * density),
    pixelHeight: Math.round(cssHeight * density),
  };
}

export function nextZoomStep(current: number, direction: 1 | -1): number {
  const steps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
  if (direction === 1) {
    const next = steps.find((step) => step > current + 0.001);
    return clampScale(next ?? MAX_SCALE);
  }
  const previous = [...steps].reverse().find((step) => step < current - 0.001);
  return clampScale(previous ?? MIN_SCALE);
}

export interface PageRenderer {
  render(page: PDFPageProxy, scale: number, rotation: number): Promise<void>;
  cancel(): void;
}

export function createPageRenderer(canvas: HTMLCanvasElement): PageRenderer {
  let task: RenderTask | null = null;

  return {
    async render(page, scale, rotation) {
      task?.cancel();
      task = null;

      const ratio = globalThis.devicePixelRatio ?? 1;
      const viewport = page.getViewport({ scale, rotation: page.rotate + rotation });
      const density = Math.min(3, Math.max(1, ratio));

      canvas.width = Math.max(1, Math.round(viewport.width * density));
      canvas.height = Math.max(1, Math.round(viewport.height * density));

      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(density, 0, 0, density, 0, 0);

      const current = page.render({ canvas, canvasContext: context, viewport });
      task = current;
      try {
        await current.promise;
      } catch (error) {
        const name = (error as { name?: string })?.name ?? '';
        if (name !== 'RenderingCancelledException') throw error;
      } finally {
        if (task === current) task = null;
      }
    },
    cancel() {
      task?.cancel();
      task = null;
    },
  };
}

export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}
