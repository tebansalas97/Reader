import { allowAssetDir } from '$lib/fs/api';

export type AllowDir = (path: string) => Promise<void>;

const ASSET_PREFIX = 'http://asset.localhost/';

const granted = new Set<string>();

function key(dir: string): string {
  return dir.toLowerCase();
}

export function missingDirs(dirs: readonly string[], known: ReadonlySet<string>): string[] {
  const wanted: string[] = [];
  const seen = new Set(known);
  for (const dir of dirs) {
    if (dir.length === 0 || seen.has(key(dir))) continue;
    seen.add(key(dir));
    wanted.push(dir);
  }
  return wanted;
}

export async function grantAssetDirs(
  dirs: readonly string[],
  allow: AllowDir = allowAssetDir,
  known: Set<string> = granted,
): Promise<boolean> {
  const wanted = missingDirs(dirs, known);
  if (wanted.length === 0) return false;

  let done = false;
  for (const dir of wanted) {
    try {
      await allow(dir);
      known.add(key(dir));
      done = true;
    } catch {
      continue;
    }
  }
  return done;
}

export function retryBroken(root: HTMLElement): number {
  let again = 0;
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    if (!src.startsWith(ASSET_PREFIX)) continue;
    if (img.naturalWidth > 0) continue;
    img.removeAttribute('src');
    img.setAttribute('src', src);
    again += 1;
  }
  return again;
}
