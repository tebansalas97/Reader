export interface TextPiece {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
}

interface RawItem {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
  height?: unknown;
}

function numbers(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length < 6) return null;
  return value.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0));
}

export function pieceFrom(item: RawItem, viewportHeight: number, scale: number): TextPiece | null {
  const text = typeof item.str === 'string' ? item.str : '';
  if (text.trim().length === 0) return null;

  const transform = numbers(item.transform);
  if (!transform) return null;

  const [a, b, , d, e, f] = transform as [number, number, number, number, number, number];
  const fontHeight = Math.hypot(b, d) || Math.abs(d) || 1;
  const width = typeof item.width === 'number' ? item.width : 0;

  return {
    text,
    left: e * scale,
    top: viewportHeight - (f + fontHeight) * scale,
    width: Math.max(0, width * scale),
    height: Math.max(1, fontHeight * scale),
    angle: Math.atan2(b, a),
  };
}

export function piecesFrom(
  items: unknown[],
  viewportHeight: number,
  scale: number,
): TextPiece[] {
  const pieces: TextPiece[] = [];
  for (const item of items) {
    const piece = pieceFrom(item as RawItem, viewportHeight, scale);
    if (piece) pieces.push(piece);
  }
  return pieces;
}

export function styleFor(piece: TextPiece): string {
  const rotation = piece.angle === 0 ? '' : ` rotate(${piece.angle}rad)`;
  return [
    `left: ${piece.left.toFixed(2)}px`,
    `top: ${piece.top.toFixed(2)}px`,
    `font-size: ${piece.height.toFixed(2)}px`,
    `--piece-width: ${piece.width.toFixed(2)}px`,
    `transform: translateY(0)${rotation}`,
  ].join('; ');
}
