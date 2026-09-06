import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface FsChanged {
  path: string;
  kind: 'modified' | 'removed';
}

export function onFsChanged(cb: (e: FsChanged) => void): Promise<UnlistenFn> {
  return listen<FsChanged>('fs:changed', (e) => cb(e.payload));
}

export function onOpenPaths(cb: (paths: string[]) => void): Promise<UnlistenFn> {
  return listen<string[]>('app:open-paths', (e) => cb(e.payload));
}
