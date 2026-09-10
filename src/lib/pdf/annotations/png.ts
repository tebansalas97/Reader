import type { Rect } from './model';
import { fitInside, ratioOf } from './stamp';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function looksLikePng(bytes: Uint8Array): boolean {
  if (bytes.length < SIGNATURE.length) return false;
  return SIGNATURE.every((value, index) => bytes[index] === value);
}

export function bytesToDataUrl(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

export function inkBounds(
  data: ArrayLike<number>,
  width: number,
  height: number,
  threshold = 8,
): Rect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3] ?? 0;
      if (alpha <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export interface ShrunkPng {
  image: string;
  ratio: number;
}

export async function shrinkPng(source: string, limit: number): Promise<ShrunkPng | null> {
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', reject, { once: true });
      image.src = source;
    });
  } catch {
    return null;
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width === 0 || height === 0) return null;
  if (Math.max(width, height) <= limit) {
    return { image: source, ratio: ratioOf(width, height) };
  }

  const box = fitInside(width, height, limit);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, box.width);
  canvas.height = Math.max(1, box.height);
  const context = canvas.getContext('2d');
  if (!context) return { image: source, ratio: ratioOf(width, height) };
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { image: canvas.toDataURL('image/png'), ratio: ratioOf(canvas.width, canvas.height) };
}
