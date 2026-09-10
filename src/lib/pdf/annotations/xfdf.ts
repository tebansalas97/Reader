import { boundsOf, newAnnotationId, type Annotation, type AnnotationKind, type Point, type Quad } from './model';
import { opacityFor } from './selection';

const NAMESPACE = 'http://ns.adobe.com/xfdf/';

const TAGS: Record<AnnotationKind, string> = {
  highlight: 'highlight',
  underline: 'underline',
  strikeout: 'strikeout',
  ink: 'ink',
  note: 'text',
  rect: 'square',
  ellipse: 'circle',
  stamp: 'stamp',
  freetext: 'freetext',
};

const KINDS = new Map<string, AnnotationKind>(
  Object.entries(TAGS)
    .filter(([kind]) => kind !== 'stamp')
    .map(([kind, tag]) => [tag, kind as AnnotationKind]),
);

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function number(value: number): string {
  return Number(value.toFixed(3)).toString();
}

export function xfdfDate(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number): string => value.toString().padStart(2, '0');
  return (
    `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export function parseXfdfDate(value: string | null): number {
  const found = /^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/.exec(value ?? '');
  if (!found) return Date.now();
  return Date.UTC(
    Number(found[1]),
    Number(found[2]) - 1,
    Number(found[3]),
    Number(found[4] ?? '0'),
    Number(found[5] ?? '0'),
    Number(found[6] ?? '0'),
  );
}

function rectText(annotation: Annotation): string {
  const bounds = boundsOf(annotation);
  if (!bounds) return '0,0,0,0';
  return [
    number(bounds.x),
    number(bounds.y),
    number(bounds.x + bounds.width),
    number(bounds.y + bounds.height),
  ].join(',');
}

function coordsText(quads: Quad[]): string {
  return quads
    .flatMap((quad) => [
      quad.x1,
      quad.y1,
      quad.x2,
      quad.y2,
      quad.x4,
      quad.y4,
      quad.x3,
      quad.y3,
    ])
    .map(number)
    .join(',');
}

function inkText(strokes: Point[][]): string {
  return strokes
    .map((stroke) => `<gesture>${stroke.map((point) => `${number(point.x)},${number(point.y)}`).join(';')}</gesture>`)
    .join('');
}

export function exportable(annotation: Annotation): boolean {
  return annotation.kind !== 'stamp';
}

export function toXfdf(annotations: readonly Annotation[], source = ''): string {
  const body = annotations
    .filter(exportable)
    .map((annotation) => {
      const tag = TAGS[annotation.kind];
      const attributes = [
        `page="${annotation.page - 1}"`,
        `rect="${rectText(annotation)}"`,
        `color="${annotation.color.toUpperCase()}"`,
        `opacity="${number(annotation.opacity)}"`,
        `title="${escapeXml(annotation.author)}"`,
        `creationdate="${xfdfDate(annotation.createdMs)}"`,
        `flags="print"`,
      ];
      if (annotation.quads) attributes.push(`coords="${coordsText(annotation.quads)}"`);
      const inner = [
        `<contents>${escapeXml(annotation.contents)}</contents>`,
        annotation.ink ? `<inklist>${inkText(annotation.ink)}</inklist>` : '',
      ].join('');
      return `<${tag} ${attributes.join(' ')}>${inner}</${tag}>`;
    })
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<xfdf xmlns="${NAMESPACE}" xml:space="preserve">\n` +
    `<annots>\n${body}${body ? '\n' : ''}</annots>\n` +
    (source ? `<f href="${escapeXml(source)}"/>\n` : '') +
    `</xfdf>\n`
  );
}

function numbers(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
}

function quadsFrom(values: number[]): Quad[] {
  const quads: Quad[] = [];
  for (let index = 0; index + 7 < values.length; index += 8) {
    quads.push({
      x1: values[index]!,
      y1: values[index + 1]!,
      x2: values[index + 2]!,
      y2: values[index + 3]!,
      x3: values[index + 6]!,
      y3: values[index + 7]!,
      x4: values[index + 4]!,
      y4: values[index + 5]!,
    });
  }
  return quads;
}

function inkFrom(node: Element): Point[][] {
  const strokes: Point[][] = [];
  for (const gesture of Array.from(node.getElementsByTagName('gesture'))) {
    const points: Point[] = [];
    for (const pair of (gesture.textContent ?? '').split(';')) {
      const [x, y] = numbers(pair);
      if (x !== undefined && y !== undefined) points.push({ x, y });
    }
    if (points.length > 0) strokes.push(points);
  }
  return strokes;
}

function colorFrom(value: string | null): string {
  const found = /^#?([0-9a-fA-F]{6})$/.exec(value ?? '');
  return found ? `#${found[1]!.toLowerCase()}` : '#ffd400';
}

export function fromXfdf(text: string): Annotation[] {
  const parsed = new DOMParser().parseFromString(text, 'application/xml');
  if (parsed.getElementsByTagName('parsererror').length > 0) return [];

  const found: Annotation[] = [];
  for (const node of Array.from(parsed.getElementsByTagName('*'))) {
    const kind = KINDS.get(node.localName.toLowerCase());
    if (!kind) continue;

    const page = Number(node.getAttribute('page') ?? '0') + 1;
    const rectValues = numbers(node.getAttribute('rect'));
    const quads = quadsFrom(numbers(node.getAttribute('coords')));
    const ink = inkFrom(node);
    const opacity = Number(node.getAttribute('opacity') ?? '');

    const annotation: Annotation = {
      id: newAnnotationId(),
      page: Number.isFinite(page) && page >= 1 ? page : 1,
      kind,
      color: colorFrom(node.getAttribute('color')),
      opacity: Number.isFinite(opacity) && opacity > 0 ? opacity : opacityFor(kind),
      contents: node.getElementsByTagName('contents')[0]?.textContent ?? '',
      author: node.getAttribute('title') ?? '',
      createdMs: parseXfdfDate(node.getAttribute('creationdate')),
      origin: 'reader',
    };

    if (quads.length > 0) annotation.quads = quads;
    if (ink.length > 0) annotation.ink = ink;
    if (rectValues.length === 4) {
      const [left, bottom, right, top] = rectValues as [number, number, number, number];
      annotation.rect = {
        x: Math.min(left, right),
        y: Math.min(bottom, top),
        width: Math.abs(right - left),
        height: Math.abs(top - bottom),
      };
    }

    if (kind === 'ink' && ink.length === 0) continue;
    if ((kind === 'highlight' || kind === 'underline' || kind === 'strikeout') && quads.length === 0)
      continue;
    if ((kind === 'note' || kind === 'rect' || kind === 'ellipse') && !annotation.rect) continue;
    if (kind !== 'note' && kind !== 'rect' && kind !== 'ellipse') delete annotation.rect;

    found.push(annotation);
  }
  return found;
}
