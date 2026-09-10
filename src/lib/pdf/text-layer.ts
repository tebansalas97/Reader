import { multiplyMatrix, viewportTransform, type Matrix } from './annotations/geometry';
import type { PageSize } from './document';

export interface TextPiece {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
  originX: number;
  originY: number;
  item: number;
}

interface RawItem {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
  height?: unknown;
}

function numbers(value: unknown): Matrix | null {
  if (!Array.isArray(value)) return null;
  if (value.length < 6) return null;
  const parsed = value
    .slice(0, 6)
    .map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0));
  return parsed as Matrix;
}

export function pieceFrom(
  item: RawItem,
  matrix: Matrix,
  scale: number,
  at = 0,
): TextPiece | null {
  const text = typeof item.str === 'string' ? item.str : '';
  if (text.trim().length === 0) return null;

  const transform = numbers(item.transform);
  if (!transform) return null;

  const placed = multiplyMatrix(matrix, transform);
  const angle = Math.atan2(placed[1], placed[0]);
  const height = Math.max(1, Math.hypot(placed[2], placed[3]));
  const width = typeof item.width === 'number' ? Math.max(0, item.width * scale) : 0;

  const left = angle === 0 ? placed[4] : placed[4] + height * Math.sin(angle);
  const top = angle === 0 ? placed[5] - height : placed[5] - height * Math.cos(angle);

  return {
    text,
    left,
    top,
    width,
    height,
    angle,
    originX: transform[4],
    originY: transform[5],
    item: at,
  };
}

export function piecesFrom(
  items: unknown[],
  size: PageSize,
  scale: number,
  rotation: number,
): TextPiece[] {
  const matrix = viewportTransform(size, scale, rotation);
  const pieces: TextPiece[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const piece = pieceFrom(items[index] as RawItem, matrix, scale, index);
    if (piece) pieces.push(piece);
  }
  return pieces;
}

export function scaleXFor(target: number, measured: number): number {
  if (!Number.isFinite(target) || !Number.isFinite(measured)) return 1;
  if (target <= 0 || measured <= 0) return 1;
  return target / measured;
}

export function transformOf(piece: TextPiece, stretch = 1): string {
  const parts = ['translateY(0)'];
  if (piece.angle !== 0) parts.push(`rotate(${piece.angle}rad)`);
  if (stretch !== 1) parts.push(`scaleX(${stretch.toFixed(4)})`);
  return parts.join(' ');
}

export function styleFor(piece: TextPiece, stretch = 1): string {
  return [
    `left: ${piece.left.toFixed(2)}px`,
    `top: ${piece.top.toFixed(2)}px`,
    `font-size: ${piece.height.toFixed(2)}px`,
    `transform: ${transformOf(piece, stretch)}`,
  ].join('; ');
}
