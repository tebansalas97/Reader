export const MAX_SESSION = 20;

export interface SessionEntry {
  path: string | null;
}

export function sessionPaths(open: readonly SessionEntry[]): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const entry of open) {
    const path = entry.path;
    if (path === null || seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }
  return paths.slice(0, MAX_SESSION);
}

export function pathsToRestore(session: readonly string[], startup: readonly string[], restore: boolean): string[] {
  if (!restore || startup.length > 0) return [];
  const taken = new Set(startup);
  return session.filter((path) => path.length > 0 && !taken.has(path)).slice(0, MAX_SESSION);
}

export function sameSession(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((path, index) => path === right[index]);
}
