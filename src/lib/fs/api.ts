import { invoke } from '@tauri-apps/api/core';
import {
  toReaderError,
  type Entry,
  type LineEnding,
  type RecentItem,
  type SearchOutcome,
  type Snapshot,
  type TextFile,
} from './api-types';

export {
  ReaderError,
  type Entry,
  type ErrorKind,
  type LineEnding,
  type RecentItem,
  type SearchHit,
  type SearchOutcome,
  type Snapshot,
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

export function writeBytes(path: string, bytes: number[]): Promise<void> {
  return call<void>('write_bytes', { path, bytes });
}

export function readBytes(path: string): Promise<number[]> {
  return call<number[]>('read_bytes', { path });
}

export async function readBytesRaw(path: string): Promise<Uint8Array> {
  try {
    const body = await invoke<ArrayBuffer | number[]>('read_bytes_raw', { path });
    return body instanceof ArrayBuffer ? new Uint8Array(body) : Uint8Array.from(body);
  } catch (raw) {
    throw toReaderError(raw);
  }
}

export async function writeBytesRaw(path: string, bytes: Uint8Array): Promise<number> {
  try {
    return await invoke<number>('write_bytes_raw', bytes, {
      headers: { path: encodeURIComponent(path) },
    });
  } catch (raw) {
    throw toReaderError(raw);
  }
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

export function searchFolder(
  path: string,
  query: string,
  caseSensitive: boolean,
): Promise<SearchOutcome> {
  return call<SearchOutcome>('search_folder', { path, query, caseSensitive });
}

export function snapshotDocument(path: string, text: string): Promise<void> {
  return call<void>('snapshot_document', { path, text });
}

export function listSnapshots(path: string): Promise<Snapshot[]> {
  return call<Snapshot[]>('list_snapshots', { path });
}

export function readSnapshot(path: string, id: string): Promise<string> {
  return call<string>('read_snapshot', { path, id });
}

export function clearSnapshots(path: string): Promise<void> {
  return call<void>('clear_snapshots', { path });
}
