import { invoke } from '@tauri-apps/api/core';
import { toReaderError, type Entry, type LineEnding, type RecentItem, type TextFile } from './api-types';

export {
  ReaderError,
  type Entry,
  type ErrorKind,
  type LineEnding,
  type RecentItem,
  type TextFile,
} from './api-types';

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (raw) {
    throw toReaderError(raw);
  }
}

export async function readText(path: string): Promise<TextFile> {
  const r = await call<{ text: string; modified_ms: number; line_ending: LineEnding }>('read_text', {
    path,
  });
  return { text: r.text, modifiedMs: r.modified_ms, lineEnding: r.line_ending };
}

export function writeText(path: string, text: string, lineEnding: LineEnding): Promise<number> {
  return call<number>('write_text', { path, text, lineEnding });
}

export function readBytes(path: string): Promise<number[]> {
  return call<number[]>('read_bytes', { path });
}

export function exists(path: string): Promise<boolean> {
  return call<boolean>('exists', { path });
}

export function listDir(path: string, depth = 2): Promise<Entry[]> {
  return call<Entry[]>('list_dir', { path, depth });
}

export function watch(path: string): Promise<void> {
  return call<void>('watch', { path });
}

export function unwatch(path: string): Promise<void> {
  return call<void>('unwatch', { path });
}

export function getPrefs<T>(): Promise<Partial<T>> {
  return call<Partial<T>>('get_prefs');
}

export function setPrefs(prefs: unknown): Promise<void> {
  return call<void>('set_prefs', { prefs });
}

export function getRecent(): Promise<RecentItem[]> {
  return call<RecentItem[]>('get_recent');
}

export function pushRecent(path: string): Promise<RecentItem[]> {
  return call<RecentItem[]>('push_recent', { path });
}

export function clearRecent(): Promise<void> {
  return call<void>('clear_recent');
}

export function openExternal(url: string): Promise<void> {
  return call<void>('open_external', { url });
}

export function saveAsset(docPath: string, fileName: string, bytes: number[]): Promise<string> {
  return call<string>('save_asset', { docPath, fileName, bytes });
}

export function allowAssetDir(path: string): Promise<void> {
  return call<void>('allow_asset_dir', { path });
}

export function startupPaths(): Promise<string[]> {
  return call<string[]>('startup_paths');
}
