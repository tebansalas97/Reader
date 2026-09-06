export function normalise(p: string): string {
  return p.replace(/\\/g, '/');
}

export function dirname(p: string): string {
  const n = normalise(p);
  const i = n.lastIndexOf('/');
  if (i < 0) return '';
  if (i === 0) return '/';
  return n.slice(0, i);
}

export function basename(p: string): string {
  const n = normalise(p);
  return n.slice(n.lastIndexOf('/') + 1);
}

export function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i <= 0 ? '' : b.slice(i + 1).toLowerCase();
}

export function join(...parts: string[]): string {
  return parts
    .filter((p) => p.length > 0)
    .map(normalise)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

export function isAbsolute(p: string): boolean {
  const n = normalise(p);
  return /^[a-zA-Z]:\//.test(n) || n.startsWith('//') || n.startsWith('/');
}

export function isMarkdown(p: string): boolean {
  const e = extname(p);
  return e === 'md' || e === 'markdown';
}

export function titleFromPath(p: string | null): string {
  return p ? basename(p) : 'Sin título';
}

export function isExternalUrl(s: string): boolean {
  return /^(https?:|mailto:)/i.test(s);
}

export function resolveRelative(docPath: string, rel: string): string {
  let target = rel;
  try {
    target = decodeURI(rel);
  } catch {
    target = rel;
  }
  if (isAbsolute(target)) return normalise(target);
  const segments = normalise(dirname(docPath)).split('/');
  for (const part of normalise(target).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') segments.pop();
    else segments.push(part);
  }
  return segments.join('/');
}
